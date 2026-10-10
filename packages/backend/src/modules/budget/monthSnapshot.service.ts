import { alias } from 'drizzle-orm/pg-core';
import { and, asc, eq, gt, gte, isNull, lt, sql } from 'drizzle-orm';
import type {
  BudgetSummary,
  SnapshotMember,
  SnapshotTransaction,
} from '@portfolio/common';
import { db, type Db, type Tx } from '../../db/client';
import {
  accounts,
  budgetMonthSnapshots,
  cards,
  transactionCategories,
  transactions,
  users,
  type BudgetMonthSnapshotRow,
} from '../../db/schema';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { householdOwnerFilter } from '../shared/householdScope';

/** The live snapshot for a month, or undefined when the month is open. */
export const getLiveSnapshot = async (
  householdId: string,
  month: number,
  year: number,
  executor: Db | Tx = db
): Promise<BudgetMonthSnapshotRow | undefined> => {
  const [row] = await executor
    .select()
    .from(budgetMonthSnapshots)
    .where(
      and(
        eq(budgetMonthSnapshots.householdId, householdId),
        eq(budgetMonthSnapshots.month, month),
        eq(budgetMonthSnapshots.year, year),
        isNull(budgetMonthSnapshots.supersededAt)
      )
    )
    .limit(1);
  return row;
};

/**
 * The household's debits for a month, denormalised for freezing.
 *
 * Membership matches `getBudgetSummary` exactly, and deliberately so — a row
 * in the snapshot that the summary did not count (or vice versa) is the
 * document contradicting itself.
 *
 * The INNER JOIN onto live tag rows IS the membership rule. It mirrors the
 * summary's tagged-spending query, which gets no tenure arithmetic because a
 * tag row is already household-scoped: a member joining or leaving cannot
 * move it. Nothing tenure-filtered needs adding on top, because precondition 1
 * guarantees the untagged bucket is empty at close time — an untagged debit,
 * from a departed member or anyone else, means the month cannot be closed at
 * all.
 *
 * `amount > 0` matches the summary's debit filter. Credits are not spending
 * and are not in the totals, so they must not be in the rows either.
 */
export const listSnapshotTransactions = async (
  scope: BudgetScope,
  month: number,
  year: number,
  executor: Db | Tx = db
): Promise<SnapshotTransaction[]> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const liveTags = alias(transactionCategories, 'live_tags');

  const rows = await executor
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
      categoryId: liveTags.categoryId,
      ownerId: transactions.createdBy,
      ownerEmail: users.email,
      ownerName: users.name,
      cardName: cards.name,
      accountName: accounts.name,
      accountMask: accounts.mask,
    })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.createdBy))
    .innerJoin(
      liveTags,
      and(
        eq(liveTags.transactionId, transactions.id),
        eq(liveTags.householdId, scope.householdId),
        isNull(liveTags.deletedAt)
      )
    )
    .leftJoin(cards, eq(cards.id, transactions.cardId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        gte(transactions.date, startDate),
        lt(transactions.date, endDate),
        gt(transactions.amount, 0)
      )
    )
    .orderBy(asc(transactions.date), asc(transactions.id));

  return rows.map(r => ({
    id: r.id,
    date: r.date.toISOString(),
    description: r.description,
    amount: r.amount,
    categoryId: r.categoryId,
    ownerId: r.ownerId,
    ownerEmail: r.ownerEmail,
    ...(r.ownerName ? { ownerName: r.ownerName } : {}),
    ...(r.cardName ? { cardName: r.cardName } : {}),
    ...(r.accountName ? { accountName: r.accountName } : {}),
    ...(r.accountMask ? { accountMask: r.accountMask } : {}),
  }));
};

/** JSON round-trips Dates to ISO strings, so freeze them as strings. */
const toSnapshotMembers = (scope: BudgetScope): SnapshotMember[] =>
  scope.members.map(m => ({
    userId: m.userId,
    from: m.from.toISOString(),
    to: m.to ? m.to.toISOString() : null,
  }));

export const insertSnapshot = async (
  input: {
    scope: BudgetScope;
    month: number;
    year: number;
    summary: BudgetSummary;
    transactions: SnapshotTransaction[];
    closedBy: string;
  },
  executor: Db | Tx = db
): Promise<BudgetMonthSnapshotRow> => {
  const [row] = await executor
    .insert(budgetMonthSnapshots)
    .values({
      householdId: input.scope.householdId,
      month: input.month,
      year: input.year,
      version: 1,
      members: toSnapshotMembers(input.scope),
      summary: input.summary,
      transactions: input.transactions,
      closedBy: input.closedBy,
    })
    .returning();
  return row;
};

/**
 * Household transactions dated inside a closed month that were CREATED after
 * it closed — Plaid backfills, a late CSV import.
 *
 * Information only. Nothing here folds them into the snapshot; doing that
 * would be reopening.
 */
export const countLateTransactions = async (
  scope: BudgetScope,
  month: number,
  year: number,
  since: Date,
  executor: Db | Tx = db
): Promise<number> => {
  const ownerFilter = householdOwnerFilter(scope.members);
  if (!ownerFilter) return 0;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const [row] = await executor
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(
      and(
        ownerFilter,
        gte(transactions.date, startDate),
        lt(transactions.date, endDate),
        gt(transactions.createdAt, since)
      )
    );

  return row?.count ?? 0;
};
