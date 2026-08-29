import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import path from 'path';

module.exports = async () => {
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('portfolio_test')
    .withUsername('portfolio_app')
    .withPassword('testpassword')
    .withEnvironment({ TZ: 'UTC', PGTZ: 'UTC' })
    .start();

  const uri = container.getConnectionUri();

  // Jest global setup runs in its own process, so pass the URI to the test
  // workers through the environment.
  process.env.DATABASE_URI = uri;
  process.env.DB_POOL_MAX = '5';

  // Apply migrations once for the whole run.
  const pool = new Pool({ connectionString: uri });
  await migrate(drizzle(pool), {
    migrationsFolder: path.join(__dirname, '../src/db/migrations'),
  });
  await pool.end();

  // Stash the handle so teardown can stop it.
  (globalThis as Record<string, unknown>).__PG_CONTAINER__ = container;
};
