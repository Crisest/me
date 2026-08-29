import {
  check,
  integer,
  numeric,
  pgTable,
  smallint,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryId, timestamps } from './columns';
import { users } from './users';

export const budgetOverrides = pgTable(
  'budget_overrides',
  {
    id: primaryId(),
    month: smallint('month').notNull(),
    year: integer('year').notNull(),
    salary: numeric('salary', {
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
    // Conflict target for the upsert that replaces findOneAndUpdate({upsert:true}).
    unique('budget_overrides_user_month_year_uq').on(
      t.createdBy,
      t.month,
      t.year
    ),
    check(
      'budget_overrides_month_ck',
      sql`${t.month} BETWEEN 1 AND 12`
    ),
  ]
);

export type BudgetOverrideRow = typeof budgetOverrides.$inferSelect;
export type BudgetOverrideInsert = typeof budgetOverrides.$inferInsert;
