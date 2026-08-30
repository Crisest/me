import { boolean, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { users } from './users';

export const households = pgTable(
  'households',
  {
    id: primaryId(),
    name: text('name').notNull(),
    inviteCode: text('invite_code').notNull().unique(),
    archived: boolean('archived').notNull().default(false),
    // Nullable with `set null`, unlike every other created_by in this schema.
    // A household is jointly owned: cascading would delete the other member's
    // entire budget along with the creator's user row.
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  t => [index('households_created_by_idx').on(t.createdBy)]
);

export type HouseholdRow = typeof households.$inferSelect;
export type HouseholdInsert = typeof households.$inferInsert;
