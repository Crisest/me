import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { getConfig } from '../config/env';

const config = getConfig();

export const pool = new Pool({
  connectionString: config.databaseUri,
  max: config.dbPoolMax,
});

export const db = drizzle(pool, { schema });

/**
 * The type of the root database handle.
 * Services accept `Db | Tx` so they compose inside a transaction.
 */
export type Db = NodePgDatabase<typeof schema>;

/**
 * The type of the handle passed into a `db.transaction(tx => ...)` callback.
 * Derived from Db so it can never drift from it.
 */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Drains the pool. Called on SIGTERM and in test teardown. */
export const closeDb = async (): Promise<void> => {
  await pool.end();
};
