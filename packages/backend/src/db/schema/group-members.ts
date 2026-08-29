import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { groups } from './groups';
import { users } from './users';

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  t => [
    // Composite PK gives us $addToSet semantics: inserting an existing pair
    // conflicts, and onConflictDoNothing makes the operation idempotent.
    primaryKey({ columns: [t.groupId, t.userId] }),
    // Supports "which groups is this user in?" — the query that replaces
    // Group.find({ members: userId }).
    index('group_members_user_id_idx').on(t.userId),
  ]
);

export type GroupMemberRow = typeof groupMembers.$inferSelect;
export type GroupMemberInsert = typeof groupMembers.$inferInsert;
