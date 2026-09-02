import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { ExpenseRepository } from '../database/expense.repository';
import { FamilyService } from '../family/family.service';
import { ExpenseInput, ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  const input: ExpenseInput = {
    categoryId: 'baby-shopping',
    paymentMethodId: 'upi',
    amount: 250,
    note: 'Diapers',
    expenseDate: '2026-09-02',
  };

  const user = signal<{ id: string } | null>(null);
  const add = vi.fn();
  const deleteExpense = vi.fn();
  const getAll = vi.fn();
  const getById = vi.fn();
  const update = vi.fn();

  let familyId: string | null = null;
  let service: ExpenseService;

  beforeEach(() => {
    user.set(null);
    familyId = null;
    add.mockReset();
    deleteExpense.mockReset();
    getAll.mockReset();
    getById.mockReset();
    update.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000001',
    );

    TestBed.configureTestingModule({
      providers: [
        ExpenseService,
        {
          provide: AuthService,
          useValue: { user },
        },
        {
          provide: FamilyService,
          useValue: {
            get familyId() {
              return familyId;
            },
          },
        },
        {
          provide: ExpenseRepository,
          useValue: {
            add,
            delete: deleteExpense,
            getAll,
            getById,
            update,
          },
        },
      ],
    });

    service = TestBed.inject(ExpenseService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not create an expense without an authenticated user', async () => {
    familyId = 'family-1';

    await expect(service.addExpense(input)).rejects.toThrow(
      'An authenticated user is required',
    );

    expect(add).not.toHaveBeenCalled();
  });

  it('does not create an expense without a family', async () => {
    user.set({ id: 'user-1' });

    await expect(service.addExpense(input)).rejects.toThrow(
      'A family is required',
    );

    expect(add).not.toHaveBeenCalled();
  });

  it('saves a valid expense locally with the current user and family', async () => {
    user.set({ id: 'user-1' });
    familyId = 'family-1';
    add.mockResolvedValue(undefined);

    const expense = await service.addExpense(input);

    expect(add).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000001',
      familyId: 'family-1',
      userId: 'user-1',
      categoryId: 'baby-shopping',
      paymentMethodId: 'upi',
      amount: 250,
      note: 'Diapers',
      expenseDate: '2026-09-02',
      createdAt: '2026-09-02T12:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
      syncStatus: 'pending',
    });
    expect(expense.syncStatus).toBe('pending');
  });
});
