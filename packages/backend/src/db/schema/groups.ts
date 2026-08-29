import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { users } from './users';

export const groups = pgTable(
  'groups',
  {
    id: primaryId(),
    name: text('name').notNull(),
    inviteCode: text('invite_code').notNull().unique(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  t => [index('groups_created_by_idx').on(t.createdBy)]
);

export type GroupRow = typeof groups.$inferSelect;
export type GroupInsert = typeof groups.$inferInsert;
