import { and, eq, isNull, sql } from 'drizzle-orm';
import { BudgetCategory, BudgetCategoryPayloads } from '@portfolio/common';
import { AppError } from '../../middleware/errorHandler';
import { db } from '../../db/client';
import {
  budgetCategories,
  budgetCategoryOverrides,
  transactionCategories,
  transactions,
} from '../../db/schema';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { toBudgetCategory } from './budget.mapper';

/**
 * Replaces BudgetCategorySchema.pre('validate'). The CHECK constraint
 * rejects rather than rewrites, so normalisation has to happen here to
 * preserve the existing API behaviour: an 'ignored' category carries no
 * plan; the others require a positive one.
 */
const resolvePlannedAmount = (
  kind: BudgetCategory['kind'],
  plannedAmount: number | undefined
): number => {
  if (kind === 'ignored') return 0;
  if (typeof plannedAmount !== 'number' || plannedAmount <= 0) {
    throw new AppError(
      'plannedAmount must be greater than 0 for fixed and flexible categories',
      400
    );
  }
  return plannedAmount;
};

export const listCategories = async (
  scope: BudgetScope
): Promise<BudgetCategory[]> => {
  const rows = await db.query.budgetCategories.findMany({
    where: and(
      eq(budgetCategories.householdId, scope.householdId),
      isNull(budgetCategories.deletedAt)
    ),
    orderBy: (t, { asc }) => [asc(t.kind), asc(t.name)],
  });
  return rows.map(toBudgetCategory);
};

export const createCategory = async (
  scope: BudgetScope,
  userId: string,
  payload: BudgetCategoryPayloads.Create
): Promise<BudgetCategory> => {
  const [row] = await db
    .insert(budgetCategories)
    .values({
      name: payload.name,
      kind: payload.kind,
      plannedAmount: resolvePlannedAmount(payload.kind, payload.plannedAmount),
      color: payload.color,
      createdBy: userId,
      updatedBy: userId,
      householdId: scope.householdId,
    })
    .returning();
  return toBudgetCategory(row);
};

/**
 * A `fixed` category may hold at most one transaction per calendar month.
 * Switching an existing category to `fixed` therefore has to be checked
 * against the household's tag rows already pointing at it. Tag rows, not
 * `transactions.category_id`: categories are household-owned now, and a
 * transaction's own `category_id` column is legacy.
 */
const assertFixedIsPossible = async (
  scope: BudgetScope,
  categoryId: string
): Promise<void> => {
  const [duplicate] = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${transactions.date})::int`.as(
        'year'
      ),
      month: sql<number>`EXTRACT(MONTH FROM ${transactions.date})::int`.as(
        'month'
      ),
      count: sql<number>`COUNT(*)::int`.as('count'),
    })
    .from(transactionCategories)
    .innerJoin(
      transactions,
      eq(transactions.id, transactionCategories.transactionId)
    )
    .where(
      and(
        eq(transactionCategories.categoryId, categoryId),
        eq(transactionCategories.householdId, scope.householdId),
        isNull(transactionCategories.deletedAt)
      )
    )
    .groupBy(
      sql`EXTRACT(YEAR FROM ${transactions.date})`,
      sql`EXTRACT(MONTH FROM ${transactions.date})`
    )
    .having(sql`COUNT(*) > 1`)
    .limit(1);

  if (duplicate) {
    throw new AppError(
      `Cannot make this a fixed category: ${duplicate.month}/${duplicate.year} already has ${duplicate.count} transactions tagged to it`,
      409
    );
  }
};

export const updateCategory = async (
  scope: BudgetScope,
  userId: string,
  categoryId: string,
  payload: BudgetCategoryPayloads.Update
): Promise<BudgetCategory> => {
  const existing = await db.query.budgetCategories.findFirst({
    where: and(
      eq(budgetCategories.id, categoryId),
      eq(budgetCategories.householdId, scope.householdId),
      isNull(budgetCategories.deletedAt)
    ),
  });
  if (!existing) throw new AppError('Category not found', 404);

  const nextKind = payload.kind ?? existing.kind;
  if (nextKind === 'fixed' && existing.kind !== 'fixed') {
    await assertFixedIsPossible(scope, existing.id);
  }

  const nextPlannedAmount = resolvePlannedAmount(
    nextKind,
    payload.plannedAmount ??
      (nextKind === 'ignored' ? 0 : existing.plannedAmount)
  );

  const [row] = await db
    .update(budgetCategories)
    .set({
      name: payload.name ?? existing.name,
      color: payload.color ?? existing.color,
      kind: nextKind,
      plannedAmount: nextPlannedAmount,
      updatedBy: userId,
    })
    .where(
      and(
        eq(budgetCategories.id, categoryId),
        eq(budgetCategories.householdId, scope.householdId),
        isNull(budgetCategories.deletedAt)
      )
    )
    .returning();

  // A category that stops planning also stops having month-specific plans.
  // Overrides are household-owned now, so every override on this category
  // goes, regardless of which member created it.
  if (nextKind === 'ignored') {
    await db
      .delete(budgetCategoryOverrides)
      .where(eq(budgetCategoryOverrides.categoryId, existing.id));
  }

  return toBudgetCategory(row);
};

export const deleteCategory = async (
  scope: BudgetScope,
  categoryId: string
): Promise<void> => {
  // Soft delete only: transaction_categories rows (and transactions) are
  // left untouched, so a past month can still resolve a deleted category's
  // name and kind.
  const [deleted] = await db
    .update(budgetCategories)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(budgetCategories.id, categoryId),
        eq(budgetCategories.householdId, scope.householdId),
        isNull(budgetCategories.deletedAt)
      )
    )
    .returning();

  if (!deleted) {
    throw new AppError('Category not found', 404);
  }
};
