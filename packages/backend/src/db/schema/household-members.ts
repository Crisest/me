import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryId, softDelete, timestamps } from './columns';
import { households } from './households';
import { users } from './users';

export const householdMembers = pgTable(
  'household_members',
  {
    id: primaryId(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
    ...softDelete,
  },
  t => [
    // A membership is an interval, not a pair: a surrogate id lets a user
    // leave and rejoin as a second row. This partial unique index enforces
    // the one-active-membership invariant without blocking a rejoin: only
    // rows with deleted_at IS NULL participate in the uniqueness check, so
    // a closed membership never collides with a new one.
    uniqueIndex('household_members_active_user_uq')
      .on(t.userId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('household_members_household_deleted_idx').on(
      t.householdId,
      t.deletedAt
    ),
    index('household_members_user_id_idx').on(t.userId),
  ]
);

export type HouseholdMemberRow = typeof householdMembers.$inferSelect;
export type HouseholdMemberInsert = typeof householdMembers.$inferInsert;
