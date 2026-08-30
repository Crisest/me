import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryId, softDelete, timestamps } from './columns';
import { budgetCategories } from './budget-categories';
import { households } from './households';
import { transactions } from './transactions';
import { users } from './users';

export const transactionCategories = pgTable(
  'transaction_categories',
  {
    id: primaryId(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    // `restrict`, not `cascade`: categories are soft-deleted, so a hard delete
    // should never happen, and a past month must always resolve the category
    // its tags point at.
    categoryId: uuid('category_id')
      .notNull()
      .references(() => budgetCategories.id, { onDelete: 'restrict' }),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
    ...softDelete,
  },
  t => [
    // Only a live (non-deleted) tag participates in the uniqueness check,
    // so a household can retag a transaction after removing a prior tag.
    uniqueIndex('transaction_categories_active_uq')
      .on(t.transactionId, t.householdId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('transaction_categories_household_category_idx').on(
      t.householdId,
      t.categoryId
    ),
    index('transaction_categories_transaction_id_idx').on(t.transactionId),
  ]
);

export type TransactionCategoryRow = typeof transactionCategories.$inferSelect;
export type TransactionCategoryInsert =
  typeof transactionCategories.$inferInsert;
