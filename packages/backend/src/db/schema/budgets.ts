import { numeric, pgTable, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { users } from './users';

export const budgets = pgTable('budgets', {
  id: primaryId(),
  salary: numeric('salary', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  // unique => one budget per user, replacing Mongo's `unique + sparse` index.
  createdBy: uuid('created_by')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  ...timestamps,
});

export type BudgetRow = typeof budgets.$inferSelect;
export type BudgetInsert = typeof budgets.$inferInsert;
