import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { accounts } from './accounts';
import { cards } from './cards';
import { users } from './users';

export const uploads = pgTable(
  'uploads',
  {
    id: primaryId(),
    fileName: text('file_name').notNull(),
    fileHash: text('file_hash').notNull(),
    cardId: uuid('card_id').references(() => cards.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    transactionCount: integer('transaction_count').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  t => [
    // Deliberately NOT unique: duplicate uploads are allowed today and this
    // migration preserves that. Tightening it is a separate decision.
    index('uploads_file_hash_card_id_idx').on(t.fileHash, t.cardId),
    index('uploads_file_name_card_id_idx').on(t.fileName, t.cardId),
    index('uploads_file_hash_account_id_idx').on(t.fileHash, t.accountId),
    index('uploads_file_name_account_id_idx').on(t.fileName, t.accountId),
  ]
);

export type UploadRow = typeof uploads.$inferSelect;
export type UploadInsert = typeof uploads.$inferInsert;
