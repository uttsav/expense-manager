import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { ExpenseService } from '../../../core/expenses/expense.service';
import { Expense } from '../../../shared/models/expense.model';
import { Category, CategoryService } from '../../../core/family/category.service';
import { PaymentMethod, PaymentMethodService } from '../../../core/family/payment-method.service';

@Component({
  selector: 'app-edit-expense',
  imports: [FormsModule],
  templateUrl: './edit-expense.component.html',
  styleUrl: '../add-expense/add-expense.component.scss',
})
export class EditExpenseComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly categoryService = inject(CategoryService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  public readonly amountInput = viewChild<ElementRef<HTMLInputElement>>('amountInput');

  public readonly amount = signal<number | null>(null);
  public readonly categoryId = signal('');
  public readonly paymentMethodId = signal('');
  public readonly note = signal('');
  public readonly expenseDate = signal('');

  public readonly categories = signal<Category[]>([]);
  public readonly paymentMethods = signal<PaymentMethod[]>([]);
  public readonly categoriesLoading = signal(true);
  public readonly paymentMethodsLoading = signal(true);
  public readonly lookupError = signal('');
  public readonly loading = signal(true);
  public readonly saving = signal(false);
  public readonly submitted = signal(false);
  public readonly saveError = signal('');
  public readonly successMessage = signal('');

  private expenseId: string | null = null;

  constructor() {
    afterNextRender(() => {
      this.amountInput()?.nativeElement.focus();
    });

    void this.loadLookupNames();
    void this.loadExpense();
  }

  protected hasAmountError(): boolean {
    const amount = this.amount();

    return this.submitted() && (amount === null || amount <= 0);
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

  protected hasNoteError(): boolean {
    return this.submitted() && !this.note().trim();
  }

  private async loadLookupNames(): Promise<void> {
    try {
      this.categories.set(await this.categoryService.getCategories());
      this.paymentMethods.set(await this.paymentMethodService.getPaymentMethods());
    } catch {
      this.lookupError.set('Some category and payment method names are unavailable offline.');
    } finally {
      this.categoriesLoading.set(false);
      this.paymentMethodsLoading.set(false);
    }
  }

  private async loadExpense(): Promise<void> {
    this.loading.set(true);
    try {
      this.expenseId = this.route.snapshot.paramMap.get('id');

      if (!this.expenseId) {
        throw new Error('Missing expense id');
      }

      const expense = await this.expenseService.getExpenseById(this.expenseId);

      if (!expense) {
        throw new Error('Expense not found');
      }

      this.amount.set(expense.amount);
      this.categoryId.set(expense.categoryId);
      this.paymentMethodId.set(expense.paymentMethodId);
      this.note.set(expense.note ?? '');
      this.expenseDate.set(expense.expenseDate);
    } catch (err) {
      this.saveError.set(
        err instanceof Error ? err.message : 'Unable to load expense.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.submitted.set(true);
    this.saveError.set('');

    if (
      this.hasAmountError() ||
      this.hasCategoryError() ||
      this.hasPaymentMethodError() ||
      this.hasExpenseDateError() ||
      this.hasNoteError()
    ) {
      this.saveError.set('Please enter what you bought.');
      return;
    }

    if (!this.expenseId) {
      this.saveError.set('Missing expense id');
      return;
    }

    const trimmedNote = this.note().trim();

    this.saving.set(true);

    try {
      await this.expenseService.updateExpense(this.expenseId, {
        amount: this.amount()!,
        categoryId: this.categoryId(),
        paymentMethodId: this.paymentMethodId(),
        note: trimmedNote,
        expenseDate: this.expenseDate(),
      });

      await this.router.navigate(['/dashboard']);
    } catch (err) {
      this.saveError.set(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      this.saving.set(false);
    }
  }

  async cancel(): Promise<void> {
    await this.router.navigate(['/dashboard']);
  }

  async confirmDelete(): Promise<void> {
    if (!this.expenseId) {
      this.saveError.set('Missing expense id');
      return;
    }

    const confirm = window.confirm('Delete this expense? This cannot be undone.');

    if (!confirm) {
      return;
    }

    this.saving.set(true);

    try {
      await this.expenseService.deleteExpense(this.expenseId);
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      this.saveError.set(err instanceof Error ? err.message : 'Unable to delete expense.');
    } finally {
      this.saving.set(false);
    }
  }
}
