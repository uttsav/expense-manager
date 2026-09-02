import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { ExpenseRepository } from '../database/expense.repository';
import { Expense } from '../../shared/models/expense.model';
import { SupabaseService } from '../supabase/supabase.service';
import { SyncService } from './sync.service';

describe('SyncService', () => {
  const expense: Expense = {
    id: 'expense-1',
    familyId: 'family-1',
    userId: 'user-1',
    categoryId: 'category-1',
    paymentMethodId: 'payment-method-1',
    amount: 100,
    expenseDate: '2026-09-02',
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    syncStatus: 'pending',
  };

  const user = signal<unknown>(null);
  const isOnline = signal(true);
  const getPendingSync = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();

  let service: SyncService;

  beforeEach(() => {
    user.set(null);
    isOnline.set(true);
    getPendingSync.mockReset();
    update.mockReset();
    upsert.mockReset();

    TestBed.configureTestingModule({
      providers: [
        SyncService,
        {
          provide: AuthService,
          useValue: { user },
        },
        {
          provide: ConnectivityService,
          useValue: { isOnline },
        },
        {
          provide: ExpenseRepository,
          useValue: {
            savedExpenseCount: signal(0),
            getPendingSync,
            update,
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: () => ({ upsert }),
            },
          },
        },
      ],
    });

    service = TestBed.inject(SyncService);
  });

  it('shares an active synchronization run', async () => {
    let resolveUpsert!: (value: { error: null }) => void;

    getPendingSync.mockResolvedValue([expense]);
    update.mockResolvedValue(undefined);
    upsert.mockReturnValue(new Promise((resolve) => {
      resolveUpsert = resolve;
    }));
    user.set({ id: expense.userId });

    const firstSync = service.sync();
    const secondSync = service.sync();

    expect(secondSync).toBe(firstSync);

    await vi.waitFor(() => {
      expect(upsert).toHaveBeenCalledOnce();
    });

    resolveUpsert({ error: null });
    await firstSync;

    expect(update).toHaveBeenCalledWith({
      ...expense,
      syncStatus: 'synced',
    });
  });

  it('leaves an expense pending when its upsert fails', async () => {
    getPendingSync.mockResolvedValue([expense]);
    upsert.mockResolvedValue({ error: new Error('offline') });
    user.set({ id: expense.userId });

    await service.sync();

    expect(update).not.toHaveBeenCalled();
  });
});
