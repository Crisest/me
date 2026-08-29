import { and, eq, sql } from 'drizzle-orm';
import { BudgetCategory, BudgetCategoryPayloads } from '@portfolio/common';
import { AppError } from '../../middleware/errorHandler';
import { db } from '../../db/client';
import {
  budgetCategories,
  budgetCategoryOverrides,
  transactions,
} from '../../db/schema';
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
  userId: string
): Promise<BudgetCategory[]> => {
  const rows = await db.query.budgetCategories.findMany({
    where: eq(budgetCategories.createdBy, userId),
    orderBy: (t, { asc }) => [asc(t.kind), asc(t.name)],
  });
  return rows.map(toBudgetCategory);
};

export const createCategory = async (
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
    })
    .returning();
  return toBudgetCategory(row);
};

/**
 * A `fixed` category may hold at most one transaction per calendar month.
 * Switching an existing category to `fixed` therefore has to be checked against
 * the transactions already tagged to it.
 */
const assertFixedIsPossible = async (
  userId: string,
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
    .from(transactions)
    .where(
      and(
        eq(transactions.createdBy, userId),
        eq(transactions.categoryId, categoryId)
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
  userId: string,
  categoryId: string,
  payload: BudgetCategoryPayloads.Update
): Promise<BudgetCategory> => {
  const existing = await db.query.budgetCategories.findFirst({
    where: and(
      eq(budgetCategories.id, categoryId),
      eq(budgetCategories.createdBy, userId)
    ),
  });
  if (!existing) throw new AppError('Category not found', 404);

  const nextKind = payload.kind ?? existing.kind;
  if (nextKind === 'fixed' && existing.kind !== 'fixed') {
    await assertFixedIsPossible(userId, existing.id);
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
    })
    .where(
      and(
        eq(budgetCategories.id, categoryId),
        eq(budgetCategories.createdBy, userId)
      )
    )
    .returning();

  // A category that stops planning also stops having month-specific plans.
  if (nextKind === 'ignored') {
    await db
      .delete(budgetCategoryOverrides)
      .where(
        and(
          eq(budgetCategoryOverrides.createdBy, userId),
          eq(budgetCategoryOverrides.categoryId, existing.id)
        )
      );
  }

  return toBudgetCategory(row);
};

export const deleteCategory = async (
  userId: string,
  categoryId: string
): Promise<void> => {
  // The ON DELETE rules replace the manual deleteMany + updateMany:
  //   budget_category_overrides  ON DELETE CASCADE
  //   transactions.category_id   ON DELETE SET NULL
  const deleted = await db
    .delete(budgetCategories)
    .where(
      and(
        eq(budgetCategories.id, categoryId),
        eq(budgetCategories.createdBy, userId)
      )
    )
    .returning();

  if (deleted.length === 0) {
    throw new AppError('Category not found', 404);
  }
};
