import { Injectable } from '@angular/core';

import { expenseDb } from './expense-db';
import { Expense } from '../../shared/models/expense.model';

@Injectable({
  providedIn: 'root',
})
export class ExpenseRepository {
  async add(expense: Expense): Promise<void> {
    await expenseDb.expenses.add(expense);
  }

  async update(expense: Expense): Promise<void> {
    await expenseDb.expenses.put(expense);
  }

  async getById(id: string): Promise<Expense | undefined> {
    return expenseDb.expenses.get(id);
  }

  async getAll(): Promise<Expense[]> {
    return expenseDb.expenses
      .orderBy('expenseDate')
      .reverse()
      .toArray();
  }

  async getPendingSync(): Promise<Expense[]> {
    return expenseDb.expenses
      .where('syncStatus')
      .equals('pending')
      .toArray();
  }

  async delete(id: string): Promise<void> {
    await expenseDb.expenses.delete(id);
  }
}