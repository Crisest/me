import { Pool } from 'pg';

describe('db client', () => {
  it('builds a pool from config.databaseUri with the configured max', async () => {
    jest.doMock('../config/env', () => ({
      getConfig: () => ({
        databaseUri: 'postgres://u:p@localhost:5432/testdb',
        dbPoolMax: 7,
      }),
      config: {
        databaseUri: 'postgres://u:p@localhost:5432/testdb',
        dbPoolMax: 7,
      },
    }));

    const { pool } = await import('./client');
    expect(pool).toBeInstanceOf(Pool);
    expect(pool.options.max).toBe(7);
    expect(pool.options.connectionString).toBe(
      'postgres://u:p@localhost:5432/testdb'
    );
  });
});
