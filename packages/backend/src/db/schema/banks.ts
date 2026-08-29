import { boolean, index, pgTable, text } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { plaidStatusEnum } from './enums';
import { users } from './users';
import { uuid } from 'drizzle-orm/pg-core';

export const banks = pgTable(
  'banks',
  {
    id: primaryId(),
    name: text('name').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isPlaidLinked: boolean('is_plaid_linked').notNull().default(false),
    plaidAccessToken: text('plaid_access_token'),
    plaidItemId: text('plaid_item_id'),
    plaidInstitutionId: text('plaid_institution_id'),
    plaidSyncCursor: text('plaid_sync_cursor'),
    plaidStatus: plaidStatusEnum('plaid_status'),
    ...timestamps,
  },
  t => [
    index('banks_plaid_item_id_idx').on(t.plaidItemId),
    index('banks_created_by_idx').on(t.createdBy),
  ]
);

export type BankRow = typeof banks.$inferSelect;
export type BankInsert = typeof banks.$inferInsert;
