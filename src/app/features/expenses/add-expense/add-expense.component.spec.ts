import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ExpenseService } from '../../../core/expenses/expense.service';
import { CategoryService } from '../../../core/family/category.service';
import { PaymentMethodService } from '../../../core/family/payment-method.service';
import { AddExpenseComponent } from './add-expense.component';

describe('AddExpenseComponent', () => {
  const addExpense = vi.fn();
  const getCategories = vi.fn();
  const getPaymentMethods = vi.fn();
  const navigate = vi.fn();

  let fixture: ComponentFixture<AddExpenseComponent>;
  let component: AddExpenseComponent;

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AddExpenseComponent],
      providers: [
        {
          provide: ExpenseService,
          useValue: { addExpense },
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
          useValue: { navigate },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddExpenseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function completeValidForm(): void {
    const form = component as unknown as {
      amount: { set(value: number): void };
      categoryId: { set(value: string): void };
      expenseDate: { set(value: string): void };
      paymentMethodId: { set(value: string): void };
    };

    form.amount.set(250);
    form.categoryId.set('category-1');
    form.paymentMethodId.set('payment-method-1');
    form.expenseDate.set('2026-09-02');
  }

  beforeEach(() => {
    addExpense.mockReset();
    getCategories.mockReset();
    getPaymentMethods.mockReset();
    navigate.mockReset();
    getCategories.mockResolvedValue([]);
    getPaymentMethods.mockResolvedValue([]);
    navigate.mockResolvedValue(true);
  });

  it('creates', async () => {
    await createComponent();

    expect(component).toBeTruthy();
  });

  it('cancels and navigates to the dashboard without saving', async () => {
    await createComponent();

    const cancelButton = fixture.nativeElement.querySelector(
      '.cancel-button',
    ) as HTMLButtonElement;
    cancelButton.click();
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(addExpense).not.toHaveBeenCalled();
  });

  it('does not submit an invalid form', async () => {
    await createComponent();

    await component.submit();
    fixture.detectChanges();

    expect(addExpense).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Enter an amount greater than zero.',
    );
  });

  it('saves a valid expense and navigates to the dashboard', async () => {
    addExpense.mockResolvedValue(undefined);
    await createComponent();
    completeValidForm();

    await component.submit();

    expect(addExpense).toHaveBeenCalledWith({
      amount: 250,
      categoryId: 'category-1',
      paymentMethodId: 'payment-method-1',
      note: undefined,
      expenseDate: '2026-09-02',
    });
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('displays a save error and stays on the form when local saving fails', async () => {
    addExpense.mockRejectedValue(new Error('Local storage is unavailable.'));
    await createComponent();
    completeValidForm();

    await component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Local storage is unavailable.',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows category loading while lookup data is pending', async () => {
    let resolveCategories!: (value: []) => void;

    getCategories.mockReturnValue(new Promise((resolve) => {
      resolveCategories = resolve;
    }));
    await createComponent();

    expect(fixture.nativeElement.textContent).toContain(
      'Loading categories…',
    );

    resolveCategories([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No active categories are available.',
    );
  });
});
