import { Transaction } from '@portfolio/common';

export type { Transaction } from '@portfolio/common';

export interface TransactionWithMeta extends Transaction {
  isProcessing?: boolean;
  error?: string;
}
