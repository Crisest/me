import { and, asc, eq, gt, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { BudgetSummary, BudgetCategorySummary, CategoryMemberActual } from '@portfolio/common';
import { db } from '../../db/client';
import {
  budgets,
  budgetOverrides,
  budgetCategories,
  budgetCategoryOverrides,
  transactions,
  transactionCategories,
  users,
} from '../../db/schema';
import type { BudgetScope, ScopeMember } from '../../middleware/resolveBudgetScope';

/** True when the member was in the household at any point during the month. */
export const memberCoversMonth = (
  member: ScopeMember,
  month: number,
  year: number
): boolean => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  if (member.from >= monthEnd) return false;
  if (member.to && member.to < monthStart) return false;
  return true;
};

type MemberActualRow = {
  userId: string;
  email: string;
  name: string | null;
  actual: number;
  transactionCount: number;
};

/** Deterministic so the API response (and any future assertion) is reproducible
 * regardless of Postgres's GROUP BY row order — sorted by userId ascending. */
const foldByMember = (rows: MemberActualRow[]): CategoryMemberActual[] =>
  [...rows]
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))
    .map(r => ({
      userId: r.userId,
      email: r.email,
      name: r.name ?? undefined,
      actual: r.actual,
      transactionCount: r.transactionCount,
    }));

/** Sort order matches the `category_kind` enum, used to keep the combined
 * live + resurrected-for-history category set ordered the same as the old
 * plain `ORDER BY kind, name` query. */
const KIND_ORDER: Record<string, number> = { fixed: 0, flexible: 1, ignored: 2 };

const compareCategories = (
  a: { kind: string; name: string },
  b: { kind: string; name: string }
): number => {
  const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (kindDiff !== 0) return kindDiff;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
};

/**
 * Planned-vs-actual for one month. Household-wide by default; pass `memberId`
 * to narrow income and spending to a single member (the transactions page's
 * Mine/Household toggle) while leaving the category set household-wide.
 *
 * `fixed` categories cost their plan until the real charge lands, then cost
 * whatever actually hit — so a budgeted rent never double-counts, and a rent
 * that has not been charged yet does not make the month look flush.
 * `flexible` categories cost exactly what was spent. `ignored` categories
 * (card payments, transfers between the user's own accounts) cost nothing.
 *
 * Tenure is applied at two different granularities:
 * - Income counts a member whose tenure merely *overlaps* the month
 *   (`memberCoversMonth`), because salary is a monthly figure.
 * - The untagged bucket additionally bounds each member's transactions by
 *   their exact tenure window, so a member who left mid-month only
 *   contributes transactions dated before they left.
 * Tagged spending gets no tenure arithmetic at all: a tag row is already
 * household-scoped, so a member joining or leaving cannot move it.
 */
export const getBudgetSummary = async (
  scope: BudgetScope,
  month: number,
  year: number,
  memberId?: string
): Promise<BudgetSummary> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  // `memberId` narrows every whose-money question to one member; the category
  // set stays household-wide either way, so a member viewing only their own
  // figures still sees every category the household plans for.
  const members =
    memberId === undefined
      ? scope.members
      : scope.members.filter(m => m.userId === memberId);

  const memberIds = Array.from(
    new Set(
      members.filter(m => memberCoversMonth(m, month, year)).map(m => m.userId)
    )
  );

  const categories = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.householdId, scope.householdId),
        isNull(budgetCategories.deletedAt)
      )
    )
    .orderBy(asc(budgetCategories.kind), asc(budgetCategories.name));

  const categoryIds = categories.map(c => c.id);

  const untaggedOwnerCondition =
    members.length === 0
      ? undefined
      : or(
          ...members.map(m => {
            const windowConditions = [
              eq(transactions.createdBy, m.userId),
              gte(transactions.date, m.from),
            ];
            if (m.to) windowConditions.push(lt(transactions.date, m.to));
            return and(...windowConditions);
          })
        );

  const [categoryOverrides, budgetRows, salaryOverrideRows, taggedRows, untaggedRows] =
    await Promise.all([
      categoryIds.length === 0
        ? Promise.resolve([])
        : db
            .select()
            .from(budgetCategoryOverrides)
            .where(
              and(
                inArray(budgetCategoryOverrides.categoryId, categoryIds),
                eq(budgetCategoryOverrides.month, month),
                eq(budgetCategoryOverrides.year, year)
              )
            ),
      memberIds.length === 0
        ? Promise.resolve([])
        : db.select().from(budgets).where(inArray(budgets.createdBy, memberIds)),
      memberIds.length === 0
        ? Promise.resolve([])
        : db
            .select()
            .from(budgetOverrides)
            .where(
              and(
                inArray(budgetOverrides.createdBy, memberIds),
                eq(budgetOverrides.month, month),
                eq(budgetOverrides.year, year)
              )
            ),
      db
        .select({
          categoryId: transactionCategories.categoryId,
          userId: transactions.createdBy,
          email: users.email,
          name: users.name,
          actual: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::float8`,
          transactionCount: sql<number>`COUNT(*)::int`,
        })
        .from(transactionCategories)
        .innerJoin(
          transactions,
          eq(transactions.id, transactionCategories.transactionId)
        )
        .innerJoin(users, eq(users.id, transactions.createdBy))
        .where(
          and(
            eq(transactionCategories.householdId, scope.householdId),
            isNull(transactionCategories.deletedAt),
            gte(transactions.date, startDate),
            lt(transactions.date, endDate),
            gt(transactions.amount, 0),
            ...(memberId === undefined
              ? []
              : [eq(transactions.createdBy, memberId)])
          )
        )
        .groupBy(
          transactionCategories.categoryId,
          transactions.createdBy,
          users.email,
          users.name
        ),
      untaggedOwnerCondition === undefined
        ? Promise.resolve([])
        : db
            .select({
              userId: transactions.createdBy,
              email: users.email,
              name: users.name,
              actual: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::float8`,
              transactionCount: sql<number>`COUNT(*)::int`,
            })
            .from(transactions)
            .innerJoin(users, eq(users.id, transactions.createdBy))
            .where(
              and(
                untaggedOwnerCondition,
                gte(transactions.date, startDate),
                lt(transactions.date, endDate),
                gt(transactions.amount, 0),
                sql`NOT EXISTS (
                  SELECT 1 FROM ${transactionCategories}
                  WHERE ${transactionCategories.transactionId} = ${transactions.id}
                    AND ${transactionCategories.householdId} = ${scope.householdId}
                    AND ${transactionCategories.deletedAt} IS NULL
                )`
              )
            )
            .groupBy(transactions.createdBy, users.email, users.name),
    ]);

  // A soft-deleted category still has its tag rows live: "load deleted
  // categories by id when a past month references them". A category that no
  // transaction in this month references must NOT be resurrected.
  const referencedCategoryIds = Array.from(
    new Set(taggedRows.map(r => r.categoryId))
  );
  const missingCategoryIds = referencedCategoryIds.filter(
    id => !categoryIds.includes(id)
  );
  const deletedReferencedCategories =
    missingCategoryIds.length === 0
      ? []
      : await db
          .select()
          .from(budgetCategories)
          .where(inArray(budgetCategories.id, missingCategoryIds));

  const allCategories = [...categories, ...deletedReferencedCategories].sort(
    compareCategories
  );

  const plannedByCategory = new Map<string, number>(
    categoryOverrides.map(o => [o.categoryId, o.plannedAmount])
  );

  const budgetByUser = new Map(budgetRows.map(b => [b.createdBy, b.salary]));
  const overrideByUser = new Map(salaryOverrideRows.map(o => [o.createdBy, o.salary]));

  let income = 0;
  let usingActualIncome = false;
  for (const id of memberIds) {
    const override = overrideByUser.get(id);
    if (override !== undefined) {
      usingActualIncome = true;
      income += override;
    } else {
      income += budgetByUser.get(id) ?? 0;
    }
  }

  const taggedRowsByCategory = new Map<string, MemberActualRow[]>();
  for (const row of taggedRows) {
    const list = taggedRowsByCategory.get(row.categoryId) ?? [];
    list.push(row);
    taggedRowsByCategory.set(row.categoryId, list);
  }

  const categorySummaries: BudgetCategorySummary[] = allCategories.map(category => {
    const override = plannedByCategory.get(category.id);
    const planned =
      category.kind === 'ignored' ? 0 : (override ?? category.plannedAmount);
    const rows = taggedRowsByCategory.get(category.id) ?? [];
    const actual = rows.reduce((sum, r) => sum + r.actual, 0);
    const transactionCount = rows.reduce((sum, r) => sum + r.transactionCount, 0);

    let cost: number;
    if (category.kind === 'ignored') cost = 0;
    else if (category.kind === 'fixed') cost = Math.max(planned, actual);
    else cost = actual;

    return {
      categoryId: category.id,
      name: category.name,
      kind: category.kind,
      color: category.color ?? undefined,
      planned,
      isOverridden: category.kind !== 'ignored' && override !== undefined,
      actual,
      cost,
      transactionCount,
      byMember: foldByMember(rows),
    };
  });

  const untaggedAmount = untaggedRows.reduce((sum, r) => sum + r.actual, 0);
  const untaggedCount = untaggedRows.reduce((sum, r) => sum + r.transactionCount, 0);

  const totalPlanned = categorySummaries.reduce((sum, c) => sum + c.planned, 0);
  const totalCost =
    categorySummaries.reduce((sum, c) => sum + c.cost, 0) + untaggedAmount;

  return {
    month,
    year,
    income,
    usingActualIncome,
    categories: categorySummaries,
    untagged: {
      amount: untaggedAmount,
      transactionCount: untaggedCount,
      byMember: foldByMember(untaggedRows),
    },
    totalPlanned,
    totalCost,
    moneyLeft: income - totalCost,
  };
};
