import { and, desc, eq, gte, lt, ne } from 'drizzle-orm';
import { Transaction, TransactionPayloads } from '@portfolio/common';
import { db } from '../../db/client';
import { budgetCategories, transactions } from '../../db/schema';
import { toTransaction, type TransactionEnrichment } from './transaction.mapper';
import { createUploadRecord } from '../uploads/upload.service';
import { AppError } from '../../middleware/errorHandler';

export const getAllTransactions = async (
  userId: string,
  options: { month?: number; year?: number }
): Promise<Transaction[]> => {
  const { month, year } = options;

  const filters = [eq(transactions.createdBy, userId)];
  if (month) {
    const yearSelected = year || new Date().getFullYear();
    // Preserved exactly as-is: this constructs the boundaries in the server's
    // LOCAL timezone while stored dates are UTC. See spec section 5.4 — this
    // is existing behaviour and is deliberately not changed here.
    const startDate = new Date(yearSelected, month - 1, 1);
    const endDate = new Date(yearSelected, month, 1);
    filters.push(gte(transactions.date, startDate));
    filters.push(lt(transactions.date, endDate));
  }

  const rows = await db.query.transactions.findMany({
    where: and(...filters),
    with: {
      card: { columns: { name: true }, with: { bank: { columns: { name: true } } } },
      account: {
        columns: { name: true, mask: true },
        with: { bank: { columns: { name: true } } },
      },
    },
    orderBy: desc(transactions.date),
  });

  return rows.map(row => {
    // No `as any` and no typeof guards: `with` narrows these types for us.
    const enrichment: TransactionEnrichment = {};
    if (row.card) {
      enrichment.cardName = row.card.name;
      enrichment.bankName = row.card.bank?.name;
    }
    if (row.account) {
      enrichment.accountName = row.account.name;
      enrichment.accountMask = row.account.mask ?? undefined;
      enrichment.bankName = row.account.bank?.name ?? enrichment.bankName;
    }
    return toTransaction(row, enrichment);
  });
};

/**
 * Replaces TransactionModel.fromCreateManyPayload. groupId and accountId
 * were accepted and ignored by that static; that behaviour is preserved —
 * removing the dead parameters from the caller-facing payload is separate,
 * out-of-scope work.
 */
const fromCreateManyPayload = (
  incoming: TransactionPayloads.CreateMany['transactions'],
  cardId: string,
  userId: string
) =>
  incoming.map(tx => ({
    amount: tx.amount,
    description: tx.description,
    category: tx.category ?? null,
    subDescription: tx.subDescription ?? null,
    date: new Date(tx.date),
    cardId,
    createdBy: userId,
  }));

export const createManyTransactionsByUser = async (
  userId: string,
  payload: TransactionPayloads.CreateMany
): Promise<Transaction[]> => {
  const { transactions: incoming, cardId, fileName, fileHash } = payload;

  const values = fromCreateManyPayload(incoming, cardId, userId);

  // One transaction so a failed insert cannot leave an orphaned upload record.
  return db.transaction(async tx => {
    const rows = await tx.insert(transactions).values(values).returning();
    await createUploadRecord(fileName, fileHash, cardId, rows.length, userId, tx);
    return rows.map(row => toTransaction(row));
  });
};

/**
 * Tag (or untag) a transaction to a budget category.
 * - Ownership: both the transaction and the category must belong to userId.
 * - Only debits (amount > 0) can be tagged.
 * - `fixed` categories accept at most one transaction per calendar month;
 *   `flexible` and `ignored` accept any number.
 */
export const setTransactionCategory = async (
  userId: string,
  transactionId: string,
  payload: TransactionPayloads.SetCategory
): Promise<Transaction> => {
  const { categoryId } = payload;

  const existing = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, transactionId), eq(transactions.createdBy, userId)),
  });
  if (!existing) {
    throw new AppError('Transaction not found', 404);
  }

  if (categoryId === null) {
    const [row] = await db
      .update(transactions)
      .set({ categoryId: null })
      .where(and(eq(transactions.id, transactionId), eq(transactions.createdBy, userId)))
      .returning();
    return toTransaction(row);
  }

  if (existing.amount <= 0) {
    throw new AppError('Only debit transactions can be assigned to a category', 400);
  }

  const category = await db.query.budgetCategories.findFirst({
    where: and(eq(budgetCategories.id, categoryId), eq(budgetCategories.createdBy, userId)),
  });
  if (!category) {
    throw new AppError('Category not found on your budget', 400);
  }

  if (category.kind === 'fixed') {
    const monthStart = new Date(
      existing.date.getFullYear(),
      existing.date.getMonth(),
      1
    );
    const monthEnd = new Date(
      existing.date.getFullYear(),
      existing.date.getMonth() + 1,
      1
    );
    const conflict = await db.query.transactions.findFirst({
      where: and(
        ne(transactions.id, transactionId),
        eq(transactions.createdBy, userId),
        eq(transactions.categoryId, categoryId),
        gte(transactions.date, monthStart),
        lt(transactions.date, monthEnd)
      ),
    });
    if (conflict) {
      throw new AppError(
        `"${category.name}" is already matched to "${conflict.description}" this month`,
        409
      );
    }
  }

  const [row] = await db
    .update(transactions)
    .set({ categoryId })
    .where(and(eq(transactions.id, transactionId), eq(transactions.createdBy, userId)))
    .returning();
  return toTransaction(row);
};
