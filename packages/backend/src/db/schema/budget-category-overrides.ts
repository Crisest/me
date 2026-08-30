import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryId, timestamps } from './columns';
import { budgetCategories } from './budget-categories';
import { users } from './users';

export const budgetCategoryOverrides = pgTable(
  'budget_category_overrides',
  {
    id: primaryId(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => budgetCategories.id, { onDelete: 'cascade' }),
    month: smallint('month').notNull(),
    year: integer('year').notNull(),
    plannedAmount: numeric('planned_amount', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  t => [
    index('bco_category_id_idx').on(t.categoryId),
    unique('bco_category_month_year_uq').on(t.categoryId, t.month, t.year),
    check('bco_month_ck', sql`${t.month} BETWEEN 1 AND 12`),
    check('bco_planned_amount_ck', sql`${t.plannedAmount} >= 0`),
  ]
);

export type BudgetCategoryOverrideRow =
  typeof budgetCategoryOverrides.$inferSelect;
export type BudgetCategoryOverrideInsert =
  typeof budgetCategoryOverrides.$inferInsert;
