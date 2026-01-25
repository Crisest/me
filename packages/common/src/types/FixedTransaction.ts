import { Transaction } from './Transaction';

export type FixedTransaction = Transaction & {
  recurrence?: {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number; // e.g., every 2 weeks
    daysOfWeek?: number[]; // 0 (Sunday) to 6 (Saturday)
    dayOfMonth?: number; // 1 to 31
  };
  startDate?: number;
  endDate?: number;
  active: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
};

export type CreateFixedTransactionPayload = Omit<
  FixedTransaction,
  'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'active'
>;

export type UpdateFixedTransactionPayload = Partial<
  Omit<
    FixedTransaction,
    'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'recurrence'
  > & {
    recurrence: Partial<Omit<FixedTransaction['recurrence'], 'freq'>>;
  }
>;
