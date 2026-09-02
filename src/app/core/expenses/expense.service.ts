import { Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { ExpenseRepository } from '../database/expense.repository';
import { FamilyService } from '../family/family.service';
import { Expense } from '../../shared/models/expense.model';
import { generateUUID } from '../utils/uuid';

export interface ExpenseInput {
  categoryId: string;

  paymentMethodId: string;

  amount: number;

  note?: string;

  expenseDate: string;
}

export type ExpenseUpdate = Partial<ExpenseInput>;

@Injectable({
  providedIn: 'root',
})
export class ExpenseService {
  private readonly auth = inject(AuthService);
  private readonly expenseRepository = inject(ExpenseRepository);
  private readonly family = inject(FamilyService);

  async addExpense(input: ExpenseInput): Promise<Expense> {
    const user = this.auth.user();

    if (!user) {
      throw new Error('An authenticated user is required to add an expense.');
    }

    const familyId = this.family.familyId;

    if (!familyId) {
      throw new Error('A family is required to add an expense.');
    }

    const now = new Date().toISOString();
    const expense: Expense = {
      id: generateUUID(),
      familyId,
      userId: user.id,
      categoryId: input.categoryId,
      paymentMethodId: input.paymentMethodId,
      amount: input.amount,
      note: input.note,
      expenseDate: input.expenseDate,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    await this.expenseRepository.add(expense);

    return expense;
  }

  async getExpenses(): Promise<Expense[]> {
    return this.expenseRepository.getAll();
  }

  async getExpenseById(id: string): Promise<Expense | undefined> {
    return this.expenseRepository.getById(id);
  }

  async updateExpense(
    id: string,
    changes: ExpenseUpdate,
  ): Promise<Expense> {
    const existingExpense = await this.getExpenseById(id);

    if (!existingExpense) {
      throw new Error('Expense not found.');
    }

    const expense: Expense = {
      ...existingExpense,
      ...changes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    await this.expenseRepository.update(expense);

    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    const existingExpense = await this.getExpenseById(id);

    if (!existingExpense) {
      throw new Error('Expense not found.');
    }

    const now = new Date().toISOString();

    const expense: Expense = {
      ...existingExpense,
      deletedAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    await this.expenseRepository.update(expense);
  }
}
