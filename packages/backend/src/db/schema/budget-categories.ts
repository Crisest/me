import { check, index, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryId, softDelete, timestamps } from './columns';
import { categoryKindEnum } from './enums';
import { households } from './households';
import { users } from './users';

export const budgetCategories = pgTable(
  'budget_categories',
  {
    id: primaryId(),
    name: text('name').notNull(),
    kind: categoryKindEnum('kind').notNull(),
    plannedAmount: numeric('planned_amount', {
      precision: 12,
      scale: 2,
      mode: 'number',
    })
      .notNull()
      .default(0),
    color: text('color'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
    ...softDelete,
  },
  t => [
    index('budget_categories_created_by_idx').on(t.createdBy),
    index('budget_categories_household_id_idx').on(t.householdId),
    // Replaces the conditional validator on BudgetCategorySchema.plannedAmount.
    // The service still normalises 'ignored' to 0 before writing; this is the
    // backstop for anything that bypasses the service.
    check(
      'budget_categories_planned_amount_kind_ck',
      sql`(${t.kind} = 'ignored' AND ${t.plannedAmount} = 0)
          OR (${t.kind} <> 'ignored' AND ${t.plannedAmount} > 0)`
    ),
  ]
);

export type BudgetCategoryRow = typeof budgetCategories.$inferSelect;
export type BudgetCategoryInsert = typeof budgetCategories.$inferInsert;
