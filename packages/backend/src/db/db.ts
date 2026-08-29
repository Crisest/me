import { sql } from 'drizzle-orm';
import { db } from './client';
import logger from '../utils/logger';

/**
 * Verifies database connectivity at boot. Does not run migrations —
 * `drizzle-kit migrate` runs as a separate deploy step so a failed
 * migration never leaves a half-started process.
 */
export const connectToDatabase = async (): Promise<void> => {
  try {
    await db.execute(sql`select 1`);
    logger.info('Connected to Postgres');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to Postgres');
    throw error;
  }
};
