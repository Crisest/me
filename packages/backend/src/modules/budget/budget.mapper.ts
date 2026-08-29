import type {
  Budget,
  BudgetCategory,
  BudgetCategoryOverride,
  BudgetOverride,
} from '@portfolio/common';
import type {
  BudgetCategoryOverrideRow,
  BudgetCategoryRow,
  BudgetOverrideRow,
  BudgetRow,
} from '../../db/schema';

export const toBudget = (row: BudgetRow): Budget => ({
  id: row.id,
  salary: row.salary,
  createdBy: row.createdBy,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt?.getTime(),
});

export const toBudgetOverride = (row: BudgetOverrideRow): BudgetOverride => ({
  id: row.id,
  month: row.month,
  year: row.year,
  salary: row.salary,
  createdBy: row.createdBy,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt?.getTime(),
});

export const toBudgetCategory = (row: BudgetCategoryRow): BudgetCategory => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  plannedAmount: row.plannedAmount,
  color: row.color ?? undefined,
  createdBy: row.createdBy,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt?.getTime(),
});

export const toBudgetCategoryOverride = (
  row: BudgetCategoryOverrideRow
): BudgetCategoryOverride => ({
  id: row.id,
  categoryId: row.categoryId,
  month: row.month,
  year: row.year,
  plannedAmount: row.plannedAmount,
  createdBy: row.createdBy,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt?.getTime(),
});
