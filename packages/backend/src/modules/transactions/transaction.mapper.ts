import type { Transaction } from '@portfolio/common';
import type { TransactionRow } from '../../db/schema';

/**
 * Join output that is not stored on the transaction row. Supplied by the
 * caller from a `with:` clause; previously produced by Mongoose populate.
 */
export type TransactionEnrichment = {
  cardName?: string;
  bankName?: string;
  accountName?: string;
  accountMask?: string;
  ownerEmail?: string;
  ownerName?: string;
};

export const toTransaction = (
  row: TransactionRow,
  enrichment: TransactionEnrichment = {}
): Transaction => ({
  id: row.id,
  amount: row.amount,
  description: row.description,
  category: row.category ?? undefined,
  subDescription: row.subDescription ?? undefined,
  date: row.date.toISOString(),
  // The DTO types groupId as required but Mongo allowed it to be absent;
  // '' preserves the shape the frontend already receives today.
  groupId: row.groupId ?? '',
  createdBy: row.createdBy,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt?.getTime(),
  cardId: row.cardId ?? undefined,
  accountId: row.accountId ?? undefined,
  categoryId: row.categoryId ?? undefined,
  plaidTransactionId: row.plaidTransactionId ?? undefined,
  logoUrl: row.logoUrl ?? undefined,
  categoryIconUrl: row.categoryIconUrl ?? undefined,
  ...enrichment,
});
