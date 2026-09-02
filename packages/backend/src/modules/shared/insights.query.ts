import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { budgetCategories, transactions } from '../../db/schema';
import { householdOwnerFilter } from './householdScope';

export type SpendAggregate = {
  totalSpent: number;
  debitCount: number;
  averageDebit: number;
  totalIncome: number;
  creditCount: number;
  averageCredit: number;
  matchedFixedCount: number;
};

/**
 * Categories are household-owned, so ids resolve by household rather than by
 * author: keying on `created_by` would miss a category written by a different
 * member and silently fail to exclude or match it.
 */
export const getCategoryIdsByHousehold = async (
  householdId: string,
  kind: 'fixed' | 'flexible' | 'ignored'
): Promise<string[]> => {
  const rows = await db
    .select({ id: budgetCategories.id })
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.householdId, householdId),
        eq(budgetCategories.kind, kind)
      )
    );
  return rows.map(r => r.id);
};

/**
 * Every spend facet in one pass over the rows.
 *
 * `ownerWindows` bounds each member's contribution to their actual tenure: a
 * departed member's transactions dated after they left do not count, and a
 * left-and-rejoined member (two windows, same userId) is not deduplicated.
 */
export const aggregateSpend = async (params: {
  householdId: string;
  ownerWindows: { userId: string; from: Date; to: Date | null }[];
  startDate: Date;
  endDate: Date;
  excludedCategoryIds: string[];
  fixedCategoryIds: string[];
}): Promise<SpendAggregate> => {
  const {
    householdId,
    ownerWindows,
    startDate,
    endDate,
    excludedCategoryIds,
    fixedCategoryIds,
  } = params;

  const empty: SpendAggregate = {
    totalSpent: 0,
    debitCount: 0,
    averageDebit: 0,
    totalIncome: 0,
    creditCount: 0,
    averageCredit: 0,
    matchedFixedCount: 0,
  };
  if (ownerWindows.length === 0) return empty;

  const ownerFilter = householdOwnerFilter(ownerWindows)!;

  // A transaction's category is the live tag row for this household. NULL when
  // there is none — an untagged debit must still count as spend.
  const resolvedCategoryId = sql`(
    SELECT tc.category_id FROM transaction_categories tc
    WHERE tc.transaction_id = ${transactions.id}
      AND tc.household_id = ${householdId}
      AND tc.deleted_at IS NULL
    LIMIT 1
  )`;

  // The NULL case is spelled out because SQL `NOT IN` would drop untagged
  // rows, which are spending. `<> ALL(array)` rather than NOT IN because it is
  // correct for an empty array, which is the common case.
  const isSpend = sql`${transactions.amount} > 0 AND (
    ${resolvedCategoryId} IS NULL
    OR ${resolvedCategoryId} <> ALL(${sql.param(excludedCategoryIds)}::uuid[])
  )`;

  const isCredit = sql`${transactions.amount} < 0`;

  const isMatchedFixed = sql`${transactions.amount} > 0 AND
    ${resolvedCategoryId} = ANY(${sql.param(fixedCategoryIds)}::uuid[])`;

  // Every aggregate is cast explicitly: SUM/AVG over numeric returns numeric
  // and COUNT returns bigint, both of which node-postgres yields as strings.
  const [row] = await db
    .select({
      totalSpent: sql<number>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${isSpend}), 0)::float8`,
      debitCount: sql<number>`COUNT(*) FILTER (WHERE ${isSpend})::int`,
      averageDebit: sql<number>`COALESCE(AVG(${transactions.amount}) FILTER (WHERE ${isSpend}), 0)::float8`,
      totalIncome: sql<number>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${isCredit}), 0)::float8`,
      creditCount: sql<number>`COUNT(*) FILTER (WHERE ${isCredit})::int`,
      averageCredit: sql<number>`COALESCE(AVG(${transactions.amount}) FILTER (WHERE ${isCredit}), 0)::float8`,
      matchedFixedCount: sql<number>`COUNT(DISTINCT ${resolvedCategoryId}) FILTER (WHERE ${isMatchedFixed})::int`,
    })
    .from(transactions)
    .where(
      and(
        ownerFilter,
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    );

  return row ?? empty;
};
