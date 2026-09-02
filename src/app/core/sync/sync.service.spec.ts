import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { ExpenseRepository } from '../database/expense.repository';
import { FamilyService } from '../family/family.service';
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
  const getAll = vi.fn();
  const add = vi.fn();
  const getById = vi.fn();
  let remoteSingle: any = null;
  let remoteRows: any[] = [];

  let service: SyncService;

  beforeEach(() => {
    user.set(null);
    isOnline.set(true);
    getPendingSync.mockReset();
    update.mockReset();
    upsert.mockReset();
    getAll.mockReset();
    add.mockReset();
    getById.mockReset();

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
          provide: FamilyService,
          useValue: { familyId: 'family-1' },
        },
        {
          provide: ExpenseRepository,
          useValue: {
            savedExpenseCount: signal(0),
            getPendingSync,
            update,
            getAll,
            add,
            getById,
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: () => ({
                select: () => ({
                  eq: (col: string, val: string) => {
                    if (col === 'id') {
                      return { maybeSingle: () => Promise.resolve({ data: remoteSingle, error: null }) };
                    }

                    if (col === 'family_id') {
                      return Promise.resolve({ data: remoteRows, error: null });
                    }

                    return Promise.resolve({ data: null, error: null });
                  },
                }),
                upsert,
                // allow gt in chain for pull queries
                gt: (_col: string, _val: string) => Promise.resolve({ data: remoteRows, error: null }),
              }),
            },
          },
        },
      ],
    });

    service = TestBed.inject(SyncService);
  });

  it('triggers sync when repository savedExpenseCount changes (edit trigger)', async () => {
    const spy = vi.spyOn(service, 'sync');
    // access the provider signal and increment
    const repo = TestBed.inject(ExpenseRepository) as any;
    // ensure authenticated so effect triggers sync
    const user = TestBed.inject(AuthService) as any;
    user.user.set({ id: 'user-1' });
    getAll.mockResolvedValue([]);
    repo.savedExpenseCount.set(repo.savedExpenseCount() + 1);

    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
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
    }, false);
  });

  it('leaves an expense pending when its upsert fails', async () => {
    getPendingSync.mockResolvedValue([expense]);
    upsert.mockResolvedValue({ error: new Error('offline') });
    user.set({ id: expense.userId });

    await service.sync();

    expect(update).not.toHaveBeenCalled();
  });

  it('pushes soft-deleted expense with deleted_at and marks synced', async () => {
    const deleted = { ...expense, deletedAt: '2026-09-02T12:00:00.000Z' } as Expense;
    getPendingSync.mockResolvedValue([deleted]);
    remoteSingle = null;
    upsert.mockResolvedValue({ error: null });
    update.mockResolvedValue(undefined);
    user.set({ id: deleted.userId });

    await service.sync();

    expect(upsert).toHaveBeenCalled();
    const calledWith = upsert.mock.calls[0][0];
    expect(calledWith.deleted_at).toBe('2026-09-02T12:00:00.000Z');
    expect(update).toHaveBeenCalledWith({
      ...deleted,
      syncStatus: 'synced',
    }, false);
  });

  it('accepts remote newer update and does not upsert', async () => {
    const remote = {
      id: expense.id,
      family_id: expense.familyId,
      user_id: expense.userId,
      category_id: 'category-remote',
      payment_method_id: expense.paymentMethodId,
      amount: 999,
      note: 'remote note',
      expense_date: expense.expenseDate,
      created_at: expense.createdAt,
      updated_at: '2026-09-03T00:00:00.000Z',
      deleted_at: null,
    };

    getPendingSync.mockResolvedValue([expense]);
    remoteSingle = remote;
    upsert.mockResolvedValue({ error: null });
    update.mockResolvedValue(undefined);
    user.set({ id: expense.userId });

    await service.sync();

    expect(upsert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.any(Object), false);
    const updatedArg = update.mock.calls[0][0];
    expect(updatedArg.categoryId).toBe('category-remote');
    expect(updatedArg.syncStatus).toBe('synced');
  });

  it('pushes local newer update to remote', async () => {
    const remote = {
      id: expense.id,
      family_id: expense.familyId,
      user_id: expense.userId,
      category_id: expense.categoryId,
      payment_method_id: expense.paymentMethodId,
      amount: 50,
      note: null,
      expense_date: expense.expenseDate,
      created_at: expense.createdAt,
      updated_at: '2026-08-01T00:00:00.000Z',
      deleted_at: null,
    };

    getPendingSync.mockResolvedValue([expense]);
    remoteSingle = remote;
    upsert.mockResolvedValue({ error: null });
    update.mockResolvedValue(undefined);
    user.set({ id: expense.userId });

    await service.sync();

    expect(upsert).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      ...expense,
      syncStatus: 'synced',
    }, false);
  });

  it('does not resurrect a remote deletion when remote is newer', async () => {
    const remote = {
      id: expense.id,
      family_id: expense.familyId,
      user_id: expense.userId,
      category_id: expense.categoryId,
      payment_method_id: expense.paymentMethodId,
      amount: expense.amount,
      note: null,
      expense_date: expense.expenseDate,
      created_at: expense.createdAt,
      updated_at: '2026-09-03T00:00:00.000Z',
      deleted_at: '2026-09-03T00:00:00.000Z',
    };

    const staleLocal = { ...expense, updatedAt: '2026-09-02T00:00:00.000Z' };

    getPendingSync.mockResolvedValue([staleLocal]);
    remoteSingle = remote;
    upsert.mockResolvedValue({ error: null });
    update.mockResolvedValue(undefined);
    user.set({ id: expense.userId });

    await service.sync();

    expect(upsert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
    const updatedArg = update.mock.calls[0][0];
    expect(updatedArg.deletedAt).toBe('2026-09-03T00:00:00.000Z');
  });

  it('pulls remote-only expenses into local DB when local empty', async () => {
    getPendingSync.mockResolvedValue([]);
    getAll.mockResolvedValue([]);
    getById.mockResolvedValue(undefined);
    remoteRows = [
      {
        id: 'remote-1',
        family_id: 'family-1',
        user_id: 'user-2',
        category_id: 'category-1',
        payment_method_id: 'pm-1',
        amount: 123,
        note: null,
        expense_date: '2026-09-01',
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
        deleted_at: null,
      },
    ];

    add.mockResolvedValue(undefined);
    user.set({ id: expense.userId });

    await service.sync();

    expect(add).toHaveBeenCalled();
  });
});
