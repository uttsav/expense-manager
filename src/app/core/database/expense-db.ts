import Dexie, { Table } from 'dexie';

import { Expense } from '../../shared/models/expense.model';

export class ExpenseDatabase extends Dexie {
  expenses!: Table<Expense, string>;

  constructor() {
    super('FamilyExpenseManager');

    this.version(1).stores({
      expenses: 'id, familyId, userId, expenseDate, syncStatus, updatedAt',
    });

    this.version(2).stores({
      expenses: 'id, familyId, userId, categoryId, paymentMethodId, expenseDate, syncStatus, updatedAt, deletedAt',
    });
  }
}

export const expenseDb = new ExpenseDatabase();
