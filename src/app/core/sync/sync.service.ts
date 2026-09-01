import { Injectable, inject } from '@angular/core';

import { ExpenseRepository } from '../database/expense.repository';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private readonly expenseRepository =
    inject(ExpenseRepository);

  private readonly connectivity =
    inject(ConnectivityService);

  private readonly supabase =
    inject(SupabaseService);

  async sync(): Promise<void> {
    if (!this.connectivity.isOnline()) {
      return;
    }

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
            amount: expense.amount,
            category: expense.category,
            payment_method: expense.paymentMethod,
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
  }
}