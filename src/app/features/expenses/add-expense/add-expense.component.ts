import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  ExpenseService,
} from '../../../core/expenses/expense.service';
import {
  Category,
  CategoryService,
} from '../../../core/family/category.service';
import {
  PaymentMethod,
  PaymentMethodService,
} from '../../../core/family/payment-method.service';

@Component({
  selector: 'app-add-expense',
  imports: [FormsModule],
  templateUrl: './add-expense.component.html',
  styleUrl: './add-expense.component.scss',
})
export class AddExpenseComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly categoryService = inject(CategoryService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly router = inject(Router);

  protected readonly amountInput =
    viewChild<ElementRef<HTMLInputElement>>('amountInput');

  protected readonly amount = signal<number | null>(null);
  protected readonly categoryId = signal('');
  protected readonly paymentMethodId = signal('');
  protected readonly note = signal('');
  protected readonly expenseDate = signal(this.getToday());

  protected readonly categories = signal<Category[]>([]);
  protected readonly paymentMethods = signal<PaymentMethod[]>([]);
  protected readonly categoriesLoading = signal(true);
  protected readonly paymentMethodsLoading = signal(true);
  protected readonly lookupError = signal('');
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly saveError = signal('');
  protected readonly successMessage = signal('');

  constructor() {
    afterNextRender(() => {
      this.amountInput()?.nativeElement.focus();
    });

    void this.loadCategories();
    void this.loadPaymentMethods();
  }

  protected hasAmountError(): boolean {
    const amount = this.amount();

    return this.submitted()
      && (amount === null || amount <= 0);
  }

  protected hasCategoryError(): boolean {
    return this.submitted() && !this.categoryId();
  }

  protected hasPaymentMethodError(): boolean {
    return this.submitted() && !this.paymentMethodId();
  }

  protected hasExpenseDateError(): boolean {
    return this.submitted() && !this.expenseDate();
  }

  async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.submitted.set(true);
    this.saveError.set('');
    this.successMessage.set('');

    if (
      this.hasAmountError()
      || this.hasCategoryError()
      || this.hasPaymentMethodError()
      || this.hasExpenseDateError()
    ) {
      return;
    }

    this.saving.set(true);

    try {
      await this.expenseService.addExpense({
        amount: this.amount()!,
        categoryId: this.categoryId(),
        paymentMethodId: this.paymentMethodId(),
        note: this.note().trim() || undefined,
        expenseDate: this.expenseDate(),
      });

      this.successMessage.set('Expense saved locally.');
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.saveError.set(
        error instanceof Error
          ? error.message
          : 'Unable to save your expense. Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async cancel(): Promise<void> {
    await this.router.navigate(['/dashboard']);
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categories.set(await this.categoryService.getCategories());
    } catch {
      this.lookupError.set(
        'Unable to load categories. Please try again.',
      );
    } finally {
      this.categoriesLoading.set(false);
    }
  }

  private async loadPaymentMethods(): Promise<void> {
    try {
      this.paymentMethods.set(
        await this.paymentMethodService.getPaymentMethods(),
      );
    } catch {
      this.lookupError.set(
        'Unable to load payment methods. Please try again.',
      );
    } finally {
      this.paymentMethodsLoading.set(false);
    }
  }

  private getToday(): string {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
  }
}
