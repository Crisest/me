import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { banks } from './banks';
import { users } from './users';

export const cards = pgTable(
  'cards',
  {
    id: primaryId(),
    name: text('name').notNull(),
    bankId: uuid('bank_id')
      .notNull()
      .references(() => banks.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  t => [index('cards_created_by_idx').on(t.createdBy)]
);

export type CardRow = typeof cards.$inferSelect;
export type CardInsert = typeof cards.$inferInsert;
