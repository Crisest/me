import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryId, softDelete, timestamps } from './columns';
import { suggestionStatusEnum } from './enums';
import { budgetCategories } from './budget-categories';
import { households } from './households';
import { transactions } from './transactions';
import { users } from './users';

export const categorySuggestions = pgTable(
  'category_suggestions',
  {
    id: primaryId(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    // `restrict`, not `cascade`: categories are soft-deleted, so a hard
    // delete should never happen, and a past suggestion must always resolve
    // the category it proposed.
    categoryId: uuid('category_id')
      .notNull()
      .references(() => budgetCategories.id, { onDelete: 'restrict' }),
    confidence: numeric('confidence', {
      precision: 4,
      scale: 3,
      mode: 'number',
    }).notNull(),
    reason: text('reason').notNull(),
    // 'history' or the suggester's `name`.
    source: text('source').notNull(),
    status: suggestionStatusEnum('status').notNull().default('pending'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resolvedBy: uuid('resolved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  t => [
    // Only a live (non-deleted) suggestion participates in the uniqueness
    // check, so a transaction returns to the candidate set once its prior
    // suggestion is resolved (or a new run supersedes it).
    uniqueIndex('category_suggestions_live_uq')
      .on(t.transactionId, t.householdId)
      .where(sql`${t.deletedAt} IS NULL`),
    // The review-table read: pending suggestions for a household.
    index('category_suggestions_household_status_idx').on(
      t.householdId,
      t.status
    ),
    index('category_suggestions_transaction_id_idx').on(t.transactionId),
  ]
);

export type CategorySuggestionRow = typeof categorySuggestions.$inferSelect;
export type CategorySuggestionInsert =
  typeof categorySuggestions.$inferInsert;
