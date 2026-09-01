export type ExpenseCategory =
  | 'Food'
  | 'Grocery'
  | 'Baby Shopping'
  | 'Transport'
  | 'Home'
  | 'Bills'
  | 'Shopping'
  | 'Health'
  | 'Entertainment'
  | 'Travel'
  | 'Education'
  | 'Other';

export type PaymentMethod =
  | 'UPI'
  | 'Cash'
  | 'Credit Card'
  | 'Debit Card'
  | 'Bank Transfer';

export type ExpenseSyncStatus =
  | 'pending'
  | 'synced'
  | 'failed';

export interface Expense {
  id: string;

  familyId: string;

  userId: string;

  amount: number;

  category: ExpenseCategory;

  paymentMethod: PaymentMethod;

  note?: string;

  expenseDate: string;

  createdAt: string;

  updatedAt: string;

  syncStatus: ExpenseSyncStatus;

  deletedAt?: string;
}