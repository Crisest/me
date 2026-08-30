import { sql } from 'drizzle-orm';
import { db, closeDb } from '../src/db/client';

/**
 * Every table, in no particular order — CASCADE handles the dependencies.
 * RESTART IDENTITY is harmless here (all keys are uuids) but keeps the
 * statement correct if a serial column is ever added.
 */
const TABLES = [
  'transaction_categories',
  'transactions',
  'uploads',
  'group_members',
  'groups',
  'budget_category_overrides',
  'budget_overrides',
  'budgets',
  'budget_categories',
  'household_members',
  'households',
  'accounts',
  'cards',
  'banks',
  'users',
];

export const truncateAll = async (): Promise<void> => {
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`)
  );
};

export const closeTestDb = closeDb;
