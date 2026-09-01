import Dexie, { Table } from 'dexie';

import { Expense } from '../../shared/models/expense.model';

export class ExpenseDatabase extends Dexie {
  expenses!: Table<Expense, string>;

  constructor() {
    super('FamilyExpenseManager');

    this.version(1).stores({
      expenses: 'id, familyId, userId, expenseDate, syncStatus, updatedAt',
    });
  }
}

export const expenseDb = new ExpenseDatabase();