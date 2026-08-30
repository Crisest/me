import { and, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { budgetCategories, transactions } from '../../db/schema';

export type SpendAggregate = {
  totalSpent: number;
  debitCount: number;
  averageDebit: number;
  totalIncome: number;
  creditCount: number;
  averageCredit: number;
  matchedFixedCount: number;
};

export const getCategoryIdsByKind = async (
  userIds: string[],
  kind: 'fixed' | 'flexible' | 'ignored'
): Promise<string[]> => {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ id: budgetCategories.id })
    .from(budgetCategories)
    .where(
      and(
        inArray(budgetCategories.createdBy, userIds),
        eq(budgetCategories.kind, kind)
      )
    );
  return rows.map(r => r.id);
};

/**
 * Same shape as getCategoryIdsByKind, keyed by household rather than by
 * author. Categories are household-owned: resolving ignored/fixed category
 * ids by `created_by` misses a category authored by a DIFFERENT household
 * member, which would silently fail to exclude/match it. Use this for any
 * caller that already has a BudgetScope; getCategoryIdsByKind stays as-is
 * for its existing (non-household) callers.
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
 * Replaces the $facet pipeline duplicated in transaction.insights.service.ts
 * and group.service.ts. The three facets become conditional aggregates in one
 * pass over the rows.
 */
export const aggregateSpend = async (params: {
  userIds: string[];
  startDate: Date;
  endDate: Date;
  excludedCategoryIds: string[];
  fixedCategoryIds: string[];
  /**
   * Optional. Callers that already have a BudgetScope should pass its
   * householdId: a transaction's category is then resolved from the LIVE
   * `transaction_categories` tag row (household-scoped, deleted_at IS NULL)
   * instead of the dormant `transactions.category_id` column, which
   * `setTransactionCategory` has not written to since Wave 4. Omitted, this
   * falls back to the legacy column byte-for-byte — group.service.ts still
   * relies on that path and is out of scope for this change.
   */
  householdId?: string;
  /**
   * Optional. When supplied, REPLACES the flat `inArray(createdBy, userIds)`
   * owner filter with an OR over per-window predicates
   * (`createdBy = m.userId AND date >= m.from AND (m.to IS NULL OR date < m.to)`),
   * bounding each member's contribution to their actual tenure — a departed
   * member's transactions dated after they left do not count, and a
   * left-and-rejoined member (two windows, same userId) is not deduplicated.
   * Omitted, behaviour is byte-for-byte identical to before (flat `inArray`)
   * — group.service.ts relies on that and does not pass this.
   */
  ownerWindows?: { userId: string; from: Date; to: Date | null }[];
}): Promise<SpendAggregate> => {
  const {
    userIds,
    startDate,
    endDate,
    excludedCategoryIds,
    fixedCategoryIds,
    householdId,
    ownerWindows,
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
  if (ownerWindows ? ownerWindows.length === 0 : userIds.length === 0) return empty;

  const ownerFilter = ownerWindows
    ? or(
        ...ownerWindows.map(w => {
          const conds = [
            eq(transactions.createdBy, w.userId),
            gte(transactions.date, w.from),
          ];
          if (w.to) conds.push(lt(transactions.date, w.to));
          return and(...conds)!;
        })
      )!
    : inArray(transactions.createdBy, userIds);

  // A transaction's resolved category. When householdId is supplied this is
  // the live tag row's categoryId (NULL when there is none — an untagged
  // debit must still count as spend, same as before); otherwise it falls
  // back to the legacy transactions.category_id column, preserved for
  // group.service.ts.
  const resolvedCategoryId = householdId
    ? sql`(
        SELECT tc.category_id FROM transaction_categories tc
        WHERE tc.transaction_id = ${transactions.id}
          AND tc.household_id = ${householdId}
          AND tc.deleted_at IS NULL
        LIMIT 1
      )`
    : sql`${transactions.categoryId}`;

  // Mongo's `$nin` ALSO matched documents with no categoryId — untagged
  // debits are spending. SQL `NOT IN` would drop those rows, so the NULL case
  // is spelled out. `<> ALL(array)` rather than NOT IN because it is correct
  // for an empty array, which is the common case.
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
