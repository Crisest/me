import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

module.exports = async () => {
  const container = (globalThis as Record<string, unknown>)
    .__PG_CONTAINER__ as StartedPostgreSqlContainer | undefined;
  if (container) {
    await container.stop();
  }
};
