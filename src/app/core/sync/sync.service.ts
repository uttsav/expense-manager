import { effect, Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { FamilyService } from '../family/family.service';
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

  private readonly family = inject(FamilyService);

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

      // proceed even if there are no pending expenses so we can pull remote changes

      for (const expense of pendingExpenses) {
        try {
          // Fetch remote row for conflict resolution
          const { data: remote, error: fetchError } = await this.supabase.client
            .from('expenses')
            .select(
              'id, family_id, user_id, category_id, payment_method_id, amount, note, expense_date, created_at, updated_at, deleted_at',
            )
            .eq('id', expense.id)
            .maybeSingle();

          if (fetchError) {
            throw fetchError;
          }

          const localNewer = (remote?.updated_at ?? '') < expense.updatedAt;
          const remoteNewer = (remote?.updated_at ?? '') > expense.updatedAt;

          // If remote exists and is newer, accept remote and skip upsert
          if (remote && remoteNewer) {
            const mapped: any = {
              id: remote.id,
              familyId: remote.family_id,
              userId: remote.user_id,
              categoryId: remote.category_id,
              paymentMethodId: remote.payment_method_id,
              amount: remote.amount,
              note: remote.note ?? undefined,
              expenseDate: remote.expense_date,
              createdAt: remote.created_at,
              updatedAt: remote.updated_at,
              syncStatus: 'synced',
              deletedAt: remote.deleted_at ?? undefined,
            };

            await this.expenseRepository.update(mapped, false);
            continue;
          }

          // If remote exists and timestamps equal, check for value differences
          if (remote && !localNewer && !remoteNewer) {
            // timestamps equal — avoid unnecessary writes unless fields differ
            const remoteNote = remote.note ?? undefined;
            const differs = (
              remote.family_id !== expense.familyId
              || remote.user_id !== expense.userId
              || remote.category_id !== expense.categoryId
              || remote.payment_method_id !== expense.paymentMethodId
              || Number(remote.amount) !== Number(expense.amount)
              || remote.expense_date !== expense.expenseDate
              || (remoteNote !== expense.note)
              || (remote.deleted_at ?? undefined) !== expense.deletedAt
            );

            if (differs) {
              // local may have diverged despite equal timestamps — upsert
              const { error: upsertErr } = await this.supabase.client
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

              if (upsertErr) {
                throw upsertErr;
              }

              await this.expenseRepository.update({
                ...expense,
                syncStatus: 'synced',
              }, false);
              continue;
            }

            // nothing to do, mark synced
            await this.expenseRepository.update({
              ...expense,
              syncStatus: 'synced',
            }, false);
            continue;
          }

          // If remote deleted and remote is newer or equal, accept remote deletion
          if (remote && remote.deleted_at && (remoteNewer || remote.updated_at === expense.updatedAt)) {
            const mapped: any = {
              id: remote.id,
              familyId: remote.family_id,
              userId: remote.user_id,
              categoryId: remote.category_id,
              paymentMethodId: remote.payment_method_id,
              amount: remote.amount,
              note: remote.note ?? undefined,
              expenseDate: remote.expense_date,
              createdAt: remote.created_at,
              updatedAt: remote.updated_at,
              syncStatus: 'synced',
              deletedAt: remote.deleted_at ?? undefined,
            };

            await this.expenseRepository.update(mapped);
            continue;
          }

          // Otherwise, local is newer or remote missing — push local
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
          }, false);
        } catch (error) {
          console.error(
            'Expense synchronization failed',
            expense.id,
            error,
          );
        }
      }

      // Pull remote changes after pushing pending local changes
      // compute latest local updatedAt for family
      const localAll = await this.expenseRepository.getAll();
      const currentFamilyId = this.family.familyId;

      if (!currentFamilyId) {
        return;
      }

      const lastUpdatedAt = localAll
        .filter((e) => e.familyId === currentFamilyId)
        .reduce((max: string | null, e) => (max == null || e.updatedAt > max ? e.updatedAt : max), null as string | null);

      // build query
      let query = this.supabase.client
        .from('expenses')
        .select(
          'id, family_id, user_id, category_id, payment_method_id, amount, note, expense_date, created_at, updated_at, deleted_at',
        )
        .eq('family_id', currentFamilyId);

      if (lastUpdatedAt) {
        query = (query as any).gt('updated_at', lastUpdatedAt);
      }

      const { data: remoteRows, error: remoteFetchErr } = await (query as any);

      if (remoteFetchErr) {
        console.error('Failed to pull remote expenses', remoteFetchErr);
        return;
      }

      for (const remote of (remoteRows ?? []) as any[]) {
        try {
          const local = await this.expenseRepository.getById(remote.id);

          const mapped: any = {
            id: remote.id,
            familyId: remote.family_id,
            userId: remote.user_id,
            categoryId: remote.category_id,
            paymentMethodId: remote.payment_method_id,
            amount: remote.amount,
            note: remote.note ?? undefined,
            expenseDate: remote.expense_date,
            createdAt: remote.created_at,
            updatedAt: remote.updated_at,
            syncStatus: 'synced',
            deletedAt: remote.deleted_at ?? undefined,
          };

          if (!local) {
            await this.expenseRepository.add(mapped);
            continue;
          }

          if (local.updatedAt < remote.updated_at) {
            await this.expenseRepository.update(mapped);
          }
          // else local is newer; keep local
        } catch (err) {
          console.error('Failed merging remote expense', remote.id, err);
        }
      }
    } catch (error) {
      console.error('Expense synchronization run failed', error);
    }
  }
}
