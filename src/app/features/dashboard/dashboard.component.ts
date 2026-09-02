import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ExpenseRepository } from '../../core/database/expense.repository';
import { ExpenseService } from '../../core/expenses/expense.service';
import { Category, CategoryService } from '../../core/family/category.service';
import { FamilyService } from '../../core/family/family.service';
import {
  PaymentMethod,
  PaymentMethodService,
} from '../../core/family/payment-method.service';
import { Expense } from '../../shared/models/expense.model';

interface RecentExpense {
  id: string;
  amount: number;
  categoryName: string;
  expenseDate: string;
  note?: string;
  paymentMethodName: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly expenseService = inject(ExpenseService);
  private readonly categoryService = inject(CategoryService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly familyService = inject(FamilyService);
  private readonly router = inject(Router);
  private readonly expenseRepository = inject(ExpenseRepository, { optional: true });

  private readonly today = this.getLocalDate(new Date());
  private readonly currentMonth = this.today.slice(0, 7);
  private readonly weekStart = this.getWeekStart(this.today);
  private readonly weekEnd = this.getWeekEnd(this.weekStart);

  protected readonly expenses = signal<Expense[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly paymentMethods = signal<PaymentMethod[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly lookupError = signal('');

  protected readonly monthTotal = computed(() =>
    this.getTotal((expense) =>
      expense.expenseDate.startsWith(this.currentMonth),
    ),
  );

  protected readonly weekTotal = computed(() =>
    this.getTotal((expense) =>
      expense.expenseDate >= this.weekStart
      && expense.expenseDate <= this.weekEnd,
    ),
  );

  protected readonly todayTotal = computed(() =>
    this.getTotal((expense) => expense.expenseDate === this.today),
  );

  protected readonly recentExpenses = computed<RecentExpense[]>(() => {
    const categoryNames = new Map(
      (this.categories() ?? []).map((category) => [category.id, category.name]),
    );
    const paymentMethodNames = new Map(
      (this.paymentMethods() ?? []).map((paymentMethod) => [
        paymentMethod.id,
        paymentMethod.name,
      ]),
    );

    return [...(this.expenses() ?? [])]
      .sort((first, second) =>
        second.expenseDate.localeCompare(first.expenseDate)
        || second.createdAt.localeCompare(first.createdAt),
      )
      .slice(0, 10)
      .map((expense) => ({
        id: expense.id,
        amount: expense.amount,
        categoryName: categoryNames.get(expense.categoryId)
          ?? 'Category unavailable',
        expenseDate: expense.expenseDate,
        note: expense.note,
        paymentMethodName: paymentMethodNames.get(expense.paymentMethodId)
          ?? 'Payment method unavailable',
      }));
  });

  protected readonly monthHeading = this.formatMonth(this.today);
  protected readonly memberName = computed(() =>
    this.familyService.membership()?.name
    || this.auth.user()?.email?.split('@')[0]
    || 'there',
  );

  constructor() {
    void this.loadExpenses();
    // Reload when repository content changes (including remote pull updates)
    effect(() => {
      if (!this.expenseRepository) return;
      this.expenseRepository.repoChanged();
      void this.loadExpenses();
    });
    void this.loadLookupNames();
  }

  async retry(): Promise<void> {
    await this.loadExpenses();
  }

  async goToAddExpense(): Promise<void> {
    await this.router.navigate(['/expenses/add']);
  }

  async goToEditExpense(id: string): Promise<void> {
    await this.router.navigate([`/expenses/${id}/edit`]);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/auth/login']);
  }

  protected formatExpenseDate(expenseDate: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(expenseDate);

    if (!match) {
      return expenseDate;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return expenseDate;
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private async loadExpenses(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const familyId = this.familyService.familyId;
      const expenses = await this.expenseService.getExpenses();

      this.expenses.set(
        expenses.filter((expense) =>
          expense.familyId === familyId && !expense.deletedAt,
        ),
      );
    } catch {
      this.errorMessage.set(
        'Your expenses could not be loaded. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async loadLookupNames(): Promise<void> {
    try {
      const [categories, paymentMethods] = await Promise.all([
        this.categoryService.getCategories(),
        this.paymentMethodService.getPaymentMethods(),
      ]);

      this.categories.set(categories);
      this.paymentMethods.set(paymentMethods);
    } catch {
      this.lookupError.set(
        'Some category and payment method names are unavailable offline.',
      );
    }
  }

  private getTotal(matches: (expense: Expense) => boolean): number {
    return this.expenses()
      .filter(matches)
      .reduce((total, expense) => total + expense.amount, 0);
  }

  private getLocalDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
  }

  private getWeekStart(expenseDate: string): string {
    const [year, month, day] = expenseDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const daysSinceMonday = (date.getDay() + 6) % 7;

    date.setDate(date.getDate() - daysSinceMonday);

    return this.getLocalDate(date);
  }

  private getWeekEnd(weekStart: string): string {
    const [year, month, day] = weekStart.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    date.setDate(date.getDate() + 6);

    return this.getLocalDate(date);
  }

  private formatMonth(expenseDate: string): string {
    const [year, month] = expenseDate.split('-').map(Number);

    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1));
  }
}
