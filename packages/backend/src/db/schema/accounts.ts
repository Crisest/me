import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { accountTypeEnum } from './enums';
import { banks } from './banks';
import { users } from './users';

export const accounts = pgTable(
  'accounts',
  {
    id: primaryId(),
    bankId: uuid('bank_id')
      .notNull()
      .references(() => banks.id, { onDelete: 'cascade' }),
    plaidAccountId: text('plaid_account_id').notNull().unique(),
    name: text('name').notNull(),
    officialName: text('official_name'),
    mask: text('mask'),
    type: accountTypeEnum('type').notNull(),
    subtype: text('subtype'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  t => [
    index('accounts_bank_id_idx').on(t.bankId),
    index('accounts_created_by_idx').on(t.createdBy),
  ]
);

export type AccountRow = typeof accounts.$inferSelect;
export type AccountInsert = typeof accounts.$inferInsert;
