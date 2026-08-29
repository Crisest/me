import { and, asc, eq, gt, gte, lt, sql } from 'drizzle-orm';
import { BudgetSummary, BudgetCategorySummary } from '@portfolio/common';
import { db } from '../../db/client';
import {
  budgets,
  budgetOverrides,
  budgetCategories,
  budgetCategoryOverrides,
  transactions,
} from '../../db/schema';

/**
 * Planned-vs-actual for one month.
 *
 * `fixed` categories cost their plan until the real charge lands, then cost
 * whatever actually hit — so a budgeted rent never double-counts, and a rent
 * that has not been charged yet does not make the month look flush.
 * `flexible` categories cost exactly what was spent. `ignored` categories
 * (card payments, transfers between the user's own accounts) cost nothing.
 */
export const getBudgetSummary = async (
  userId: string,
  month: number,
  year: number
): Promise<BudgetSummary> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const [budgetRows, salaryOverrideRows, categories, categoryOverrides, actuals] =
    await Promise.all([
      db.select().from(budgets).where(eq(budgets.createdBy, userId)),
      db
        .select()
        .from(budgetOverrides)
        .where(
          and(
            eq(budgetOverrides.createdBy, userId),
            eq(budgetOverrides.month, month),
            eq(budgetOverrides.year, year)
          )
        ),
      db
        .select()
        .from(budgetCategories)
        .where(eq(budgetCategories.createdBy, userId))
        .orderBy(asc(budgetCategories.kind), asc(budgetCategories.name)),
      db
        .select()
        .from(budgetCategoryOverrides)
        .where(
          and(
            eq(budgetCategoryOverrides.createdBy, userId),
            eq(budgetCategoryOverrides.month, month),
            eq(budgetCategoryOverrides.year, year)
          )
        ),
      db
        .select({
          categoryId: transactions.categoryId,
          actual: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::float8`,
          transactionCount: sql<number>`COUNT(*)::int`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.createdBy, userId),
            gte(transactions.date, startDate),
            lt(transactions.date, endDate),
            gt(transactions.amount, 0)
          )
        )
        .groupBy(transactions.categoryId),
    ]);

  const budget = budgetRows[0];
  const salaryOverride = salaryOverrideRows[0];

  const plannedByCategory = new Map<string, number>(
    categoryOverrides.map(o => [o.categoryId, o.plannedAmount])
  );

  const actualByCategory = new Map<string, { amount: number; count: number }>();
  let untaggedAmount = 0;
  let untaggedCount = 0;

  for (const row of actuals) {
    if (!row.categoryId) {
      untaggedAmount += row.actual;
      untaggedCount += row.transactionCount;
      continue;
    }
    actualByCategory.set(row.categoryId, {
      amount: row.actual,
      count: row.transactionCount,
    });
  }

  const categorySummaries: BudgetCategorySummary[] = categories.map(category => {
    const override = plannedByCategory.get(category.id);
    const planned =
      category.kind === 'ignored' ? 0 : (override ?? category.plannedAmount);
    const tally = actualByCategory.get(category.id) ?? { amount: 0, count: 0 };

    let cost: number;
    if (category.kind === 'ignored') cost = 0;
    else if (category.kind === 'fixed') cost = Math.max(planned, tally.amount);
    else cost = tally.amount;

    return {
      categoryId: category.id,
      name: category.name,
      kind: category.kind,
      color: category.color ?? undefined,
      planned,
      isOverridden: category.kind !== 'ignored' && override !== undefined,
      actual: tally.amount,
      cost,
      transactionCount: tally.count,
    };
  });

  const income = salaryOverride?.salary ?? budget?.salary ?? 0;
  const totalPlanned = categorySummaries.reduce((sum, c) => sum + c.planned, 0);
  const totalCost =
    categorySummaries.reduce((sum, c) => sum + c.cost, 0) + untaggedAmount;

  return {
    month,
    year,
    income,
    usingActualIncome: !!salaryOverride,
    categories: categorySummaries,
    untagged: { amount: untaggedAmount, transactionCount: untaggedCount },
    totalPlanned,
    totalCost,
    moneyLeft: income - totalCost,
  };
};
