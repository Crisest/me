import { alias } from 'drizzle-orm/pg-core';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
} from 'drizzle-orm';
import { Transaction, TransactionPayloads } from '@portfolio/common';
import { db, type Tx } from '../../db/client';
import {
  accounts,
  banks,
  budgetCategories,
  transactionCategories,
  transactions,
  users,
} from '../../db/schema';
import { matchToExisting, MATCH_DATE_WINDOW_MS } from './transaction.matching';
import { toTransaction, type TransactionEnrichment } from './transaction.mapper';
import { createUploadRecord } from '../uploads/upload.service';
import { AppError } from '../../middleware/errorHandler';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { householdOwnerFilter } from '../shared/householdScope';

const accountBanks = alias(banks, 'account_banks');

/**
 * Live tag rows (deletedAt IS NULL) for a set of transactions, scoped to one
 * household. Returns a map of transactionId -> categoryId.
 */
const liveTagsByTransaction = async (
  transactionIds: string[],
  householdId: string
): Promise<Map<string, string>> => {
  if (transactionIds.length === 0) return new Map();

  const rows = await db
    .select({
      transactionId: transactionCategories.transactionId,
      categoryId: transactionCategories.categoryId,
    })
    .from(transactionCategories)
    .where(
      and(
        inArray(transactionCategories.transactionId, transactionIds),
        eq(transactionCategories.householdId, householdId),
        isNull(transactionCategories.deletedAt)
      )
    );

  return new Map(rows.map(r => [r.transactionId, r.categoryId]));
};

export const getAllTransactions = async (
  userId: string,
  options: {
    month?: number;
    year?: number;
    categoryId?: string;
    scope?: 'mine' | 'household';
  },
  budgetScope: BudgetScope
): Promise<Transaction[]> => {
  const { month, year, categoryId, scope = 'mine' } = options;

  const filters = [];

  if (scope === 'household') {
    const windows = budgetScope.members.map(m => {
      const conds = [eq(transactions.createdBy, m.userId), gte(transactions.date, m.from)];
      if (m.to) conds.push(lt(transactions.date, m.to));
      return and(...conds);
    });
    // An empty member set must match nothing, not everything — return early
    // rather than build a query with an always-true/always-false filter.
    if (windows.length === 0) return [];
    filters.push(or(...windows)!);
  } else {
    filters.push(eq(transactions.createdBy, userId));
  }

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

  if (categoryId) {
    const tagged = await db
      .select({ transactionId: transactionCategories.transactionId })
      .from(transactionCategories)
      .where(
        and(
          eq(transactionCategories.categoryId, categoryId),
          eq(transactionCategories.householdId, budgetScope.householdId),
          isNull(transactionCategories.deletedAt)
        )
      );
    const taggedIds = tagged.map(t => t.transactionId);
    if (taggedIds.length === 0) return [];
    filters.push(inArray(transactions.id, taggedIds));
  }

  const rows = await db
    .select({
      transaction: transactions,
      accountName: accounts.name,
      accountMask: accounts.mask,
      accountBankName: accountBanks.name,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.createdBy))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(accountBanks, eq(accountBanks.id, accounts.bankId))
    .where(and(...filters))
    .orderBy(desc(transactions.date));

  const liveTags = await liveTagsByTransaction(
    rows.map(r => r.transaction.id),
    budgetScope.householdId
  );

  return rows.map(r => {
    const enrichment: TransactionEnrichment = {
      ownerEmail: r.ownerEmail,
      ownerName: r.ownerName ?? undefined,
    };
    if (r.accountName) {
      enrichment.accountName = r.accountName;
      enrichment.accountMask = r.accountMask ?? undefined;
      enrichment.bankName = r.accountBankName ?? undefined;
    }
    const tx = toTransaction(r.transaction, enrichment);
    // The live tag row is the source of truth for categoryId; row.categoryId
    // (mapped by toTransaction as a fallback) is dormant as of this task.
    const liveCategoryId = liveTags.get(r.transaction.id);
    if (liveCategoryId !== undefined) tx.categoryId = liveCategoryId;
    return tx;
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
  accountId: string,
  userId: string
) =>
  incoming.map(tx => ({
    amount: tx.amount,
    description: tx.description,
    category: tx.category ?? null,
    subDescription: tx.subDescription ?? null,
    date: new Date(tx.date),
    accountId,
    createdBy: userId,
  }));

export const createManyTransactionsByUser = async (
  userId: string,
  payload: TransactionPayloads.CreateMany
): Promise<TransactionPayloads.CreateManyResponse> => {
  const { transactions: incoming, accountId, fileName, fileHash } = payload;

  const values = fromCreateManyPayload(incoming, accountId, userId);

  // One transaction so a failed insert cannot leave an orphaned upload record.
  return db.transaction(async tx => {
    const owned = await tx.query.accounts.findFirst({
      columns: { id: true },
      where: and(
        eq(accounts.id, accountId),
        eq(accounts.createdBy, userId),
        isNull(accounts.deletedAt)
      ),
    });
    if (!owned) throw new AppError('Account not found', 404);

    let fresh = values;
    if (values.length > 0) {
      const times = values.map(v => v.date.getTime());
      const existing = await tx
        .select({
          id: transactions.id,
          accountId: transactions.accountId,
          amount: transactions.amount,
          description: transactions.description,
          date: transactions.date,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.createdBy, userId),
            eq(transactions.accountId, accountId),
            gte(
              transactions.date,
              new Date(Math.min(...times) - MATCH_DATE_WINDOW_MS)
            ),
            lte(
              transactions.date,
              new Date(Math.max(...times) + MATCH_DATE_WINDOW_MS)
            )
          )
        );
      const matched = matchToExisting(values, existing);
      fresh = values.filter((_, i) => matched[i] === null);
    }

    // drizzle rejects an empty values(), so an all-duplicate file skips it.
    const rows =
      fresh.length > 0
        ? await tx.insert(transactions).values(fresh).returning()
        : [];
    await createUploadRecord(
      fileName,
      fileHash,
      accountId,
      rows.length,
      userId,
      tx
    );
    return {
      transactions: rows.map(row => toTransaction(row)),
      skipped: values.length - rows.length,
    };
  });
};

/**
 * Tag (or untag) a transaction to a budget category.
 * - Ownership: the transaction must belong to userId; the category must
 *   belong to the caller's household (scope.householdId), not to the caller.
 * - Only debits (amount > 0) can be tagged.
 * - `fixed` categories accept at most one transaction per calendar month;
 *   `flexible` and `ignored` accept any number.
 * - Re-tagging REPLACES: the existing live tag row is closed (deletedAt =
 *   now) and a new one inserted, in one transaction. Untagging closes the
 *   live row and inserts nothing.
 */
export const setTransactionCategory = async (
  scope: BudgetScope,
  userId: string,
  transactionId: string,
  payload: TransactionPayloads.SetCategory
): Promise<Transaction> => {
  const { categoryId } = payload;

  // Tagging is household-scoped: any member may tag any transaction inside the
  // household's tenure windows. `transaction_categories.created_by` still
  // records the acting user, so authorship stays auditable.
  const ownerFilter = householdOwnerFilter(scope.members);
  const existing = ownerFilter
    ? await db.query.transactions.findFirst({
        where: and(eq(transactions.id, transactionId), ownerFilter),
      })
    : undefined;
  if (!existing) {
    throw new AppError('Transaction not found', 404);
  }

  const closeLiveTag = (tx: Tx) =>
    tx
      .update(transactionCategories)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(transactionCategories.transactionId, transactionId),
          eq(transactionCategories.householdId, scope.householdId),
          isNull(transactionCategories.deletedAt)
        )
      );

  if (categoryId === null) {
    await db.transaction(async tx => {
      await closeLiveTag(tx);
    });
    const result = toTransaction(existing);
    result.categoryId = undefined;
    return result;
  }

  if (existing.amount <= 0) {
    throw new AppError('Only debit transactions can be assigned to a category', 400);
  }

  const category = await db.query.budgetCategories.findFirst({
    where: and(
      eq(budgetCategories.id, categoryId),
      eq(budgetCategories.householdId, scope.householdId),
      // A deleted category leaves the current plan and stops appearing in
      // pickers — new tags into it are refused. EXISTING tag rows pointing
      // at a deleted category are untouched and stay live: a past month
      // must still resolve its name and kind.
      isNull(budgetCategories.deletedAt)
    ),
  });
  if (!category) {
    throw new AppError('Category not found in your household', 400);
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
    const [conflict] = await db
      .select({ description: transactions.description })
      .from(transactionCategories)
      .innerJoin(transactions, eq(transactions.id, transactionCategories.transactionId))
      .where(
        and(
          ne(transactionCategories.transactionId, transactionId),
          eq(transactionCategories.categoryId, categoryId),
          eq(transactionCategories.householdId, scope.householdId),
          isNull(transactionCategories.deletedAt),
          gte(transactions.date, monthStart),
          lt(transactions.date, monthEnd)
        )
      )
      .limit(1);
    if (conflict) {
      throw new AppError(
        `"${category.name}" is already matched to "${conflict.description}" this month`,
        409
      );
    }
  }

  await db.transaction(async tx => {
    await closeLiveTag(tx);
    await tx.insert(transactionCategories).values({
      transactionId,
      categoryId,
      householdId: scope.householdId,
      createdBy: userId,
    });
  });

  const result = toTransaction(existing);
  result.categoryId = categoryId;
  return result;
};
