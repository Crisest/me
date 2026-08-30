import {
  Budget,
  BudgetPayloads,
  BudgetOverride,
  BudgetOverridePayloads,
  BudgetCategoryOverride,
  BudgetCategoryPayloads,
} from '@portfolio/common';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  budgets,
  budgetOverrides,
  budgetCategories,
  budgetCategoryOverrides,
} from '../../db/schema';
import {
  toBudget,
  toBudgetOverride,
  toBudgetCategoryOverride,
} from './budget.mapper';
import { AppError } from '../../middleware/errorHandler';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';

export const getBudgetByUserId = async (
  userId: string
): Promise<Budget | null> => {
  const row = await db.query.budgets.findFirst({
    where: eq(budgets.createdBy, userId),
  });
  return row ? toBudget(row) : null;
};

export const upsertBudget = async (
  userId: string,
  payload: BudgetPayloads.Upsert
): Promise<Budget> => {
  const [row] = await db
    .insert(budgets)
    .values({ createdBy: userId, salary: payload.salary })
    .onConflictDoUpdate({
      target: budgets.createdBy,
      set: { salary: payload.salary, updatedAt: new Date() },
    })
    .returning();

  return toBudget(row);
};

export const getBudgetOverride = async (
  userId: string,
  month: number,
  year: number
): Promise<BudgetOverride | null> => {
  const row = await db.query.budgetOverrides.findFirst({
    where: and(
      eq(budgetOverrides.createdBy, userId),
      eq(budgetOverrides.month, month),
      eq(budgetOverrides.year, year)
    ),
  });
  return row ? toBudgetOverride(row) : null;
};

export const upsertBudgetOverride = async (
  userId: string,
  payload: BudgetOverridePayloads.Upsert
): Promise<BudgetOverride> => {
  const [row] = await db
    .insert(budgetOverrides)
    .values({
      createdBy: userId,
      month: payload.month,
      year: payload.year,
      salary: payload.salary,
    })
    .onConflictDoUpdate({
      target: [
        budgetOverrides.createdBy,
        budgetOverrides.month,
        budgetOverrides.year,
      ],
      set: { salary: payload.salary, updatedAt: new Date() },
    })
    .returning();
  return toBudgetOverride(row);
};

export const upsertCategoryOverride = async (
  scope: BudgetScope,
  userId: string,
  categoryId: string,
  payload: BudgetCategoryPayloads.SetOverride
): Promise<BudgetCategoryOverride> => {
  const category = await db.query.budgetCategories.findFirst({
    where: and(
      eq(budgetCategories.id, categoryId),
      eq(budgetCategories.householdId, scope.householdId),
      isNull(budgetCategories.deletedAt)
    ),
  });
  if (!category) throw new AppError('Category not found', 404);
  if (category.kind === 'ignored') {
    throw new AppError('Ignored categories cannot have a monthly target', 400);
  }

  // The conflict target must match the `bco_category_month_year_uq` unique
  // constraint on (category_id, month, year) — Postgres validates
  // ON CONFLICT's column list against an actual unique constraint at plan
  // time, so this target and that constraint must always move together.
  const [row] = await db
    .insert(budgetCategoryOverrides)
    .values({
      createdBy: userId,
      categoryId,
      month: payload.month,
      year: payload.year,
      plannedAmount: payload.plannedAmount,
    })
    .onConflictDoUpdate({
      target: [
        budgetCategoryOverrides.categoryId,
        budgetCategoryOverrides.month,
        budgetCategoryOverrides.year,
      ],
      set: { plannedAmount: payload.plannedAmount, updatedAt: new Date() },
    })
    .returning();
  return toBudgetCategoryOverride(row);
};

export const deleteCategoryOverride = async (
  scope: BudgetScope,
  categoryId: string,
  month: number,
  year: number
): Promise<void> => {
  const category = await db.query.budgetCategories.findFirst({
    where: and(
      eq(budgetCategories.id, categoryId),
      eq(budgetCategories.householdId, scope.householdId),
      isNull(budgetCategories.deletedAt)
    ),
  });
  if (!category) throw new AppError('Category not found', 404);

  await db
    .delete(budgetCategoryOverrides)
    .where(
      and(
        eq(budgetCategoryOverrides.categoryId, categoryId),
        eq(budgetCategoryOverrides.month, month),
        eq(budgetCategoryOverrides.year, year)
      )
    );
};
