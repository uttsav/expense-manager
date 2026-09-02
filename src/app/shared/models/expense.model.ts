export type ExpenseSyncStatus =
  | 'pending'
  | 'synced'
  | 'failed';

export interface Expense {
  id: string;

  familyId: string;

  userId: string;

  categoryId: string;

  paymentMethodId: string;

  amount: number;

  note?: string;

  expenseDate: string;

  createdAt: string;

  updatedAt: string;

  syncStatus: ExpenseSyncStatus;

  deletedAt?: string;
}
