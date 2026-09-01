import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { accounts } from './accounts';
import { budgetCategories } from './budget-categories';
import { cards } from './cards';
import { groups } from './groups';
import { users } from './users';

export const transactions = pgTable(
  'transactions',
  {
    id: primaryId(),
    amount: numeric('amount', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    description: text('description').notNull(),
    category: text('category'),
    subDescription: text('sub_description'),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
    groupId: uuid('group_id').references(() => groups.id, {
      onDelete: 'set null',
    }),
    cardId: uuid('card_id').references(() => cards.id, {
      onDelete: 'set null',
    }),
    // SET NULL, not CASCADE: an account row is Plaid bookkeeping that comes
    // and goes with an Item, but the transactions hanging off it are the
    // user's own history and must survive an unlink or a re-link.
    accountId: uuid('account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    categoryId: uuid('category_id').references(() => budgetCategories.id, {
      onDelete: 'set null',
    }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Plain UNIQUE reproduces Mongo's `unique + sparse`: Postgres already
    // treats NULLs as distinct in a unique index.
    plaidTransactionId: text('plaid_transaction_id').unique(),
    logoUrl: text('logo_url'),
    categoryIconUrl: text('category_icon_url'),
    ...timestamps,
  },
  t => [
    // Covers the dominant access pattern: one user's transactions for a month.
    index('transactions_created_by_date_idx').on(t.createdBy, t.date),
    index('transactions_account_id_idx').on(t.accountId),
    index('transactions_category_id_idx').on(t.categoryId),
    index('transactions_card_id_idx').on(t.cardId),
    index('transactions_group_id_idx').on(t.groupId),
  ]
);

export type TransactionRow = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
