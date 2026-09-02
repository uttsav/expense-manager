import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ExpenseService } from '../../core/expenses/expense.service';
import { CategoryService } from '../../core/family/category.service';
import { FamilyService } from '../../core/family/family.service';
import { PaymentMethodService } from '../../core/family/payment-method.service';
import { Expense } from '../../shared/models/expense.model';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  const getExpenses = vi.fn();
  const getCategories = vi.fn();
  const getPaymentMethods = vi.fn();
  const navigate = vi.fn();
  const signOut = vi.fn();
  const user = signal<{ email: string } | null>({ email: 'sam@example.com' });
  const membership = signal({ name: 'Sam', family_id: 'family-1' });

  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  function expense(
    id: string,
    amount: number,
    expenseDate: string,
    categoryId = 'category-1',
    paymentMethodId = 'payment-method-1',
  ): Expense {
    return {
      id,
      familyId: 'family-1',
      userId: 'user-1',
      categoryId,
      paymentMethodId,
      amount,
      expenseDate,
      createdAt: `${expenseDate}T12:00:00.000Z`,
      updatedAt: `${expenseDate}T12:00:00.000Z`,
      syncStatus: 'synced',
    };
  }

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        {
          provide: AuthService,
          useValue: { user, signOut },
        },
        {
          provide: ExpenseService,
          useValue: { getExpenses },
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
          provide: FamilyService,
          useValue: {
            membership,
            get familyId() {
              return membership()?.family_id ?? null;
            },
          },
        },
        {
          provide: Router,
          useValue: { navigate },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 12));
    getExpenses.mockReset();
    getCategories.mockReset();
    getPaymentMethods.mockReset();
    navigate.mockReset();
    signOut.mockReset();
    user.set({ email: 'sam@example.com' });
    membership.set({ name: 'Sam', family_id: 'family-1' });
    getCategories.mockResolvedValue([
      { id: 'category-1', familyId: 'family-1', name: 'Baby Shopping', isActive: true, sortOrder: 1 },
      { id: 'category-2', familyId: 'family-1', name: 'Shopping', isActive: true, sortOrder: 2 },
    ]);
    getPaymentMethods.mockResolvedValue([
      { id: 'payment-method-1', familyId: 'family-1', name: 'UPI', isActive: true, sortOrder: 1 },
    ]);
    navigate.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates', async () => {
    getExpenses.mockResolvedValue([]);
    await createComponent();

    expect(component).toBeTruthy();
  });

  it('calculates month, week, and today totals from local expense dates', async () => {
    getExpenses.mockResolvedValue([
      expense('today', 100, '2026-09-09'),
      expense('monday', 50, '2026-09-07'),
      expense('month', 25, '2026-09-01'),
      expense('previous-month', 75, '2026-08-31'),
    ]);
    await createComponent();

    const dashboard = component as unknown as {
      monthTotal(): number;
      todayTotal(): number;
      weekTotal(): number;
    };

    expect(dashboard.monthTotal()).toBe(175);
    expect(dashboard.weekTotal()).toBe(150);
    expect(dashboard.todayTotal()).toBe(100);
  });

  it('orders recent expenses and resolves their category and payment method names', async () => {
    getExpenses.mockResolvedValue([
      expense('oldest', 30, '2026-09-01', 'category-2'),
      expense('newest', 40, '2026-09-09'),
      expense('middle', 20, '2026-09-07'),
    ]);
    await createComponent();

    const items = Array.from(
      fixture.nativeElement.querySelectorAll('.expense-item'),
    ) as HTMLElement[];

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Baby Shopping'),
      expect.stringContaining('Baby Shopping'),
      expect.stringContaining('Shopping'),
    ]);
    expect(items[0].textContent).toContain('₹40');
    expect(items[0].textContent).toContain('UPI');
  });

  it('shows the empty state and navigates to Add Expense', async () => {
    getExpenses.mockResolvedValue([]);
    await createComponent();

    expect(fixture.nativeElement.textContent).toContain('No expenses yet');

    const addButton = fixture.nativeElement.querySelector(
      '.empty-state button',
    ) as HTMLButtonElement;
    addButton.click();
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledWith(['/expenses/add']);
  });

  it('shows a local loading error and retries without exposing it', async () => {
    getExpenses.mockRejectedValueOnce(new Error('Dexie failed'));
    await createComponent();

    expect(fixture.nativeElement.textContent).toContain(
      'Your expenses could not be loaded. Please try again.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Dexie failed');

    getExpenses.mockResolvedValueOnce([]);
    const retryButton = fixture.nativeElement.querySelector(
      '.error-state button',
    ) as HTMLButtonElement;
    retryButton.click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No expenses yet');
  });
});
