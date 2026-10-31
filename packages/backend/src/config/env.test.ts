jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('env config', () => {
  let saved: NodeJS.ProcessEnv;

  beforeEach(() => {
    saved = { ...process.env };
  });

  afterEach(() => {
    process.env = saved;
  });

  it('throws in production when JWT_SECRET is unset', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URI = 'postgres://x';
    delete process.env.JWT_SECRET;

    expect(() => jest.isolateModules(() => require('./env'))).toThrow(
      'JWT_SECRET must be set in production'
    );
  });

  it('does not require JWT_SECRET outside production', () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URI = 'postgres://x';
    delete process.env.JWT_SECRET;

    expect(() => jest.isolateModules(() => require('./env'))).not.toThrow();
  });
});
