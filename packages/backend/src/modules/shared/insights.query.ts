import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
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
}): Promise<SpendAggregate> => {
  const { userIds, startDate, endDate, excludedCategoryIds, fixedCategoryIds } =
    params;

  const empty: SpendAggregate = {
    totalSpent: 0,
    debitCount: 0,
    averageDebit: 0,
    totalIncome: 0,
    creditCount: 0,
    averageCredit: 0,
    matchedFixedCount: 0,
  };
  if (userIds.length === 0) return empty;

  // Mongo's `$nin` ALSO matched documents with no categoryId — untagged
  // debits are spending. SQL `NOT IN` would drop those rows, so the NULL case
  // is spelled out. `<> ALL(array)` rather than NOT IN because it is correct
  // for an empty array, which is the common case.
  const isSpend = sql`${transactions.amount} > 0 AND (
    ${transactions.categoryId} IS NULL
    OR ${transactions.categoryId} <> ALL(${sql.param(excludedCategoryIds)}::uuid[])
  )`;

  const isCredit = sql`${transactions.amount} < 0`;

  const isMatchedFixed = sql`${transactions.amount} > 0 AND
    ${transactions.categoryId} = ANY(${sql.param(fixedCategoryIds)}::uuid[])`;

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
      matchedFixedCount: sql<number>`COUNT(DISTINCT ${transactions.categoryId}) FILTER (WHERE ${isMatchedFixed})::int`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.createdBy, userIds),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    );

  return row ?? empty;
};
