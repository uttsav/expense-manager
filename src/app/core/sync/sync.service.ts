import { effect, Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { ExpenseRepository } from '../database/expense.repository';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private activeSync: Promise<void> | null = null;

  private readonly auth = inject(AuthService);

  private readonly expenseRepository =
    inject(ExpenseRepository);

  private readonly connectivity =
    inject(ConnectivityService);

  private readonly supabase =
    inject(SupabaseService);

  private readonly syncOnChanges = effect(() => {
    this.expenseRepository.savedExpenseCount();

    if (this.auth.user() && this.connectivity.isOnline()) {
      void this.sync();
    }
  });

  sync(): Promise<void> {
    if (this.activeSync) {
      return this.activeSync;
    }

    const syncRun = this.runSync();
    this.activeSync = syncRun;

    void syncRun.then(
      () => this.clearActiveSync(syncRun),
      () => this.clearActiveSync(syncRun),
    );

    return syncRun;
  }

  private clearActiveSync(syncRun: Promise<void>): void {
    if (this.activeSync === syncRun) {
      this.activeSync = null;
    }
  }

  private async runSync(): Promise<void> {
    if (!this.auth.user() || !this.connectivity.isOnline()) {
      return;
    }

    try {
      const pendingExpenses =
        await this.expenseRepository.getPendingSync();

      if (!pendingExpenses.length) {
        return;
      }

      for (const expense of pendingExpenses) {
        try {
          const { error } = await this.supabase.client
            .from('expenses')
            .upsert({
              id: expense.id,
              family_id: expense.familyId,
              user_id: expense.userId,
              category_id: expense.categoryId,
              payment_method_id: expense.paymentMethodId,
              amount: expense.amount,
              note: expense.note ?? null,
              expense_date: expense.expenseDate,
              created_at: expense.createdAt,
              updated_at: expense.updatedAt,
              deleted_at: expense.deletedAt ?? null,
            });

          if (error) {
            throw error;
          }

          await this.expenseRepository.update({
            ...expense,
            syncStatus: 'synced',
          });
        } catch (error) {
          console.error(
            'Expense synchronization failed',
            expense.id,
            error,
          );
        }
      }
    } catch (error) {
      console.error('Expense synchronization run failed', error);
    }
  }
}
