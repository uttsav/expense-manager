import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { EditExpenseComponent } from './edit-expense.component';
import { ExpenseService } from '../../../core/expenses/expense.service';
import { CategoryService } from '../../../core/family/category.service';
import { PaymentMethodService } from '../../../core/family/payment-method.service';
import { Router, ActivatedRoute } from '@angular/router';

describe('EditExpenseComponent', () => {
  const getExpenseById = vi.fn();
  const updateExpense = vi.fn();
  const deleteExpense = vi.fn();
  const getCategories = vi.fn();
  const getPaymentMethods = vi.fn();

  const routerNavigate = vi.fn();

  beforeEach(() => {
    getExpenseById.mockReset();
    updateExpense.mockReset();
    deleteExpense.mockReset();
    getCategories.mockReset();
    getPaymentMethods.mockReset();
    routerNavigate.mockReset();

    TestBed.configureTestingModule({
      providers: [
        EditExpenseComponent,
        {
          provide: ExpenseService,
          useValue: { getExpenseById, updateExpense, deleteExpense },
        },
        {
          provide: CategoryService,
          useValue: { getCategories },
        },
        {
          provide: PaymentMethodService,
          useValue: { getPaymentMethods },
        },
        {
          provide: Router,
          useValue: { navigate: routerNavigate },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'expense-1' } } },
        },
      ],
    });
  });

  it('loads existing expense and populates fields', async () => {
    getExpenseById.mockResolvedValue({
      id: 'expense-1',
      amount: 123,
      categoryId: 'cat-1',
      paymentMethodId: 'pm-1',
      note: 'hello',
      expenseDate: '2026-09-02',
    });
    getCategories.mockResolvedValue([]);
    getPaymentMethods.mockResolvedValue([]);

    const comp = TestBed.inject(EditExpenseComponent);

    // wait for async init
    await new Promise((r) => setTimeout(r, 0));

    expect(comp.amount()).toBe(123);
    expect(comp.categoryId()).toBe('cat-1');
    expect(comp.paymentMethodId()).toBe('pm-1');
    expect(comp.note()).toBe('hello');
    expect(comp.expenseDate()).toBe('2026-09-02');
  });

  it('keeps existing notes and trims/validates before saving', async () => {
    getExpenseById.mockResolvedValue({
      id: 'expense-1',
      amount: 50,
      categoryId: 'cat-1',
      paymentMethodId: 'pm-1',
      note: 'Existing note',
      expenseDate: '2026-09-02',
    });
    getCategories.mockResolvedValue([]);
    getPaymentMethods.mockResolvedValue([]);
    updateExpense.mockResolvedValue({});

    const comp = TestBed.inject(EditExpenseComponent);
    await new Promise((r) => setTimeout(r, 0));

    expect(comp.note()).toBe('Existing note');

    comp.amount.set(75);
    comp.note.set('  Milk and bread  ');

    await comp.submit();

    expect(updateExpense).toHaveBeenCalledWith('expense-1', {
      amount: 75,
      categoryId: 'cat-1',
      paymentMethodId: 'pm-1',
      note: 'Milk and bread',
      expenseDate: '2026-09-02',
    });
    expect(routerNavigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('rejects a blank note when saving an edited expense', async () => {
    getExpenseById.mockResolvedValue({
      id: 'expense-1',
      amount: 50,
      categoryId: 'cat-1',
      paymentMethodId: 'pm-1',
      note: 'Existing note',
      expenseDate: '2026-09-02',
    });
    getCategories.mockResolvedValue([]);
    getPaymentMethods.mockResolvedValue([]);

    const comp = TestBed.inject(EditExpenseComponent);
    await new Promise((r) => setTimeout(r, 0));

    comp.note.set('   ');
    await comp.submit();

    expect(updateExpense).not.toHaveBeenCalled();
    expect(comp.saveError()).toBe('Please enter what you bought.');
  });

  it('delete confirms and calls deleteExpense', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    getExpenseById.mockResolvedValue({
      id: 'expense-1',
      amount: 50,
      categoryId: 'cat-1',
      paymentMethodId: 'pm-1',
      note: '',
      expenseDate: '2026-09-02',
    });
    getCategories.mockResolvedValue([]);
    getPaymentMethods.mockResolvedValue([]);
    deleteExpense.mockResolvedValue(undefined);

    const comp = TestBed.inject(EditExpenseComponent);
    await new Promise((r) => setTimeout(r, 0));

    await comp.confirmDelete();

    expect(deleteExpense).toHaveBeenCalledWith('expense-1');
    expect(routerNavigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('delete confirmation canceled does not call delete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    getExpenseById.mockResolvedValue({
      id: 'expense-1',
      amount: 50,
      categoryId: 'cat-1',
      paymentMethodId: 'pm-1',
      note: '',
      expenseDate: '2026-09-02',
    });
    getCategories.mockResolvedValue([]);
    getPaymentMethods.mockResolvedValue([]);
    deleteExpense.mockResolvedValue(undefined);

    const comp = TestBed.inject(EditExpenseComponent);
    await new Promise((r) => setTimeout(r, 0));

    await comp.confirmDelete();

    expect(deleteExpense).not.toHaveBeenCalled();
    expect(routerNavigate).not.toHaveBeenCalled();
  });

  it('delete failure stays on the edit page and sets error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    getExpenseById.mockResolvedValue({
      id: 'expense-1',
      amount: 50,
      categoryId: 'cat-1',
      paymentMethodId: 'pm-1',
      note: '',
      expenseDate: '2026-09-02',
    });
    getCategories.mockResolvedValue([]);
    getPaymentMethods.mockResolvedValue([]);
    deleteExpense.mockRejectedValue(new Error('delete failed'));

    const comp = TestBed.inject(EditExpenseComponent);
    await new Promise((r) => setTimeout(r, 0));

    await comp.confirmDelete();

    expect(deleteExpense).toHaveBeenCalledWith('expense-1');
    expect(routerNavigate).not.toHaveBeenCalled();
    expect(comp.saveError()).toBeTruthy();
  });

  it('save failure stays on the edit page and sets error', async () => {
    getExpenseById.mockResolvedValue({
      id: 'expense-1',
      amount: 50,
      categoryId: 'cat-1',
      paymentMethodId: 'pm-1',
      note: '',
      expenseDate: '2026-09-02',
    });
    getCategories.mockResolvedValue([]);
    getPaymentMethods.mockResolvedValue([]);
    updateExpense.mockRejectedValue(new Error('save failed'));

    const comp = TestBed.inject(EditExpenseComponent);
    await new Promise((r) => setTimeout(r, 0));

    await comp.submit();

    expect(updateExpense).toHaveBeenCalled();
    expect(routerNavigate).not.toHaveBeenCalled();
    expect(comp.saveError()).toBeTruthy();
  });

  it('cancel edit navigates to dashboard and does not call update', async () => {
    getExpenseById.mockResolvedValue({
      id: 'expense-1',
      amount: 50,
      categoryId: 'cat-1',
      paymentMethodId: 'pm-1',
      note: '',
      expenseDate: '2026-09-02',
    });
    getCategories.mockResolvedValue([]);
    getPaymentMethods.mockResolvedValue([]);

    const comp = TestBed.inject(EditExpenseComponent);
    await new Promise((r) => setTimeout(r, 0));

    await comp.cancel();

    expect(routerNavigate).toHaveBeenCalledWith(['/dashboard']);
    expect(updateExpense).not.toHaveBeenCalled();
  });

  it('has a delete action method present', async () => {
    const comp = TestBed.inject(EditExpenseComponent);
    expect(typeof comp.confirmDelete).toBe('function');
  });
});
