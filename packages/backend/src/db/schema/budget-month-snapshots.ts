import {
  check,
  integer,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type {
  BudgetSummary,
  SnapshotMember,
  SnapshotTransaction,
} from '@portfolio/common';
import { primaryId, timestamps } from './columns';
import { households } from './households';
import { users } from './users';

/**
 * A frozen month.
 *
 * `summary` and `transactions` are the only places `packages/common` types are
 * stored in the database. They are read back verbatim, so both may only ever
 * GAIN OPTIONAL FIELDS — see the comments on those types.
 *
 * There is no `deleted_at`. A snapshot is never deleted, not even softly: it
 * is superseded (`superseded_at` set, `version` incremented on its
 * replacement) so "what changed between v1 and v2" stays answerable by
 * diffing two frozen objects. Nothing in the current scope writes
 * `superseded_at`; every snapshot is v1.
 */
export const budgetMonthSnapshots = pgTable(
  'budget_month_snapshots',
  {
    id: primaryId(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    month: smallint('month').notNull(),
    year: integer('year').notNull(),
    version: smallint('version').notNull().default(1),
    members: jsonb('members').$type<SnapshotMember[]>().notNull(),
    summary: jsonb('summary').$type<BudgetSummary>().notNull(),
    transactions: jsonb('transactions')
      .$type<SnapshotTransaction[]>()
      .notNull(),
    // SET NULL per the project's FK policy: a departed user must not take a
    // household's closed months with them.
    closedBy: uuid('closed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    // `created_at` IS the close time. There is no separate `closed_at`.
    ...timestamps,
  },
  t => [
    // PARTIAL, deliberately. A plain unique constraint would let a superseded
    // snapshot permanently block its own month from being closed again.
    uniqueIndex('bms_household_month_year_live_uq')
      .on(t.householdId, t.month, t.year)
      .where(sql`${t.supersededAt} IS NULL`),
    check('bms_month_ck', sql`${t.month} BETWEEN 1 AND 12`),
  ]
);

export type BudgetMonthSnapshotRow = typeof budgetMonthSnapshots.$inferSelect;
export type BudgetMonthSnapshotInsert = typeof budgetMonthSnapshots.$inferInsert;
