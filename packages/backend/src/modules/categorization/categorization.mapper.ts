import type { CategorySuggestion } from '@portfolio/common';
import type { CategorySuggestionRow } from '../../db/schema';

/** The transaction and owner columns joined alongside a suggestion row. */
export type SuggestionTransactionJoin = {
  id: string;
  description: string;
  subDescription: string | null;
  amount: number;
  date: Date;
  ownerName: string | null;
  ownerEmail: string;
};

export const toCategorySuggestion = (
  row: CategorySuggestionRow,
  txn: SuggestionTransactionJoin
): CategorySuggestion => ({
  id: row.id,
  categoryId: row.categoryId,
  confidence: row.confidence,
  reason: row.reason,
  source: row.source,
  status: row.status,
  createdAt: row.createdAt.getTime(),
  transaction: {
    id: txn.id,
    description: txn.description,
    subDescription: txn.subDescription ?? undefined,
    amount: txn.amount,
    date: txn.date.toISOString(),
    ownerName: txn.ownerName ?? undefined,
    ownerEmail: txn.ownerEmail,
  },
});
