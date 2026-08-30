import type { MongoMemoryServer as MongoMemoryServerType } from 'mongodb-memory-server';
import type { MongoClient as MongoClientType, Db as MongoDbType } from 'mongodb';
import { ObjectId } from 'mongodb';
import { sql } from 'drizzle-orm';
import type { compareChecksums as compareChecksumsType, Check } from './verify';

/**
 * `runVerify` reads its Mongo connection string from process.env.MONGODB_URI
 * via `../../config/env`, which captures `process.env` into a module-level
 * constant the first time it is imported. Same hazard as `load.test.ts`: if
 * anything that transitively imports `../../config/env` were imported
 * statically at the top of this file — including `./verify` itself, just to
 * get `compareChecksums` — config would be captured before MONGODB_URI is
 * pointed at the in-memory Mongo below. So nothing from `./verify`,
 * `../../db/client`, `../../db/schema`, `../../../test/setup` or
 * `../../../test/helpers/factories` is imported statically; all of it is
 * `require`d lazily inside the top-level `beforeAll`, after MONGODB_URI is
 * set, and shared by both describe blocks below.
 */

let mongod: MongoMemoryServerType;
let mongoUri: string;
let mongoClient: MongoClientType;
let mongoDb: MongoDbType;

let compareChecksums: typeof compareChecksumsType;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let runVerify: () => Promise<any[]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let schema: any;
let truncateAll: () => Promise<void>;
let closeTestDb: () => Promise<void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let factories: any;

beforeAll(async () => {
  jest.setTimeout(120_000);

  const { MongoMemoryServer } = require('mongodb-memory-server');
  mongod = await MongoMemoryServer.create();
  mongoUri = mongod.getUri('portfolio_etl_verify_test');
  process.env.MONGODB_URI = mongoUri;

  const { MongoClient } = require('mongodb');
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoDb = mongoClient.db();

  ({ compareChecksums, runVerify } = require('./verify'));
  ({ db } = require('../../db/client'));
  schema = require('../../db/schema');
  ({ truncateAll, closeTestDb } = require('../../../test/setup'));
  factories = require('../../../test/helpers/factories');
});

afterAll(async () => {
  await mongoClient?.close();
  await mongod?.stop();
  // This file's require of '../../db/client' created its own Pool instance
  // (Jest gives each test file a fresh module registry), so it must close
  // its own pool rather than relying on another suite's afterAll to have
  // done it.
  await closeTestDb();
});

describe('compareChecksums', () => {
  it('passes when every bucket matches to the cent', () => {
    const m = new Map([['u1|2026-01', 1234.56]]);
    const p = new Map([['u1|2026-01', 1234.56]]);
    expect(compareChecksums(m, p).every(c => c.passed)).toBe(true);
  });

  it('fails on a one-cent difference', () => {
    const m = new Map([['u1|2026-01', 1234.56]]);
    const p = new Map([['u1|2026-01', 1234.57]]);
    const checks = compareChecksums(m, p);
    expect(checks.some(c => !c.passed)).toBe(true);
    expect(checks.find(c => !c.passed)!.detail).toContain('1234.56');
  });

  it('fails when Postgres is missing a bucket entirely', () => {
    const m = new Map([['u1|2026-01', 10]]);
    const p = new Map<string, number>();
    expect(compareChecksums(m, p).some(c => !c.passed)).toBe(true);
  });

  it('fails when Postgres has a bucket Mongo does not', () => {
    const m = new Map<string, number>();
    const p = new Map([['u1|2026-01', 10]]);
    expect(compareChecksums(m, p).some(c => !c.passed)).toBe(true);
  });

  it('tolerates float noise below half a cent', () => {
    const m = new Map([['u1|2026-01', 0.1 + 0.2]]);
    const p = new Map([['u1|2026-01', 0.3]]);
    expect(compareChecksums(m, p).every(c => c.passed)).toBe(true);
  });
});

describe('runVerify', () => {
  beforeEach(async () => {
    await truncateAll();
    const collections = await mongoDb.listCollections().toArray();
    for (const c of collections) {
      await mongoDb.collection(c.name).deleteMany({});
    }
  });

  /**
   * Seeds one row/document in every collection `runVerify` checks, with
   * matching transaction amounts so every count and checksum check passes.
   * Mongo docs beyond `transactions` only need to exist — `runVerify` only
   * counts them, it never reads their fields — but the Postgres rows need
   * real FK chains to insert at all.
   */
  const seedMatchingDataset = async (amount = 123.45) => {
    const user = await factories.makeUser();
    const bank = await factories.makeBank(user.id);
    const card = await factories.makeCard(user.id, bank.id);
    await factories.makeAccount(user.id, bank.id);
    const category = await factories.makeBudgetCategory(user.id);
    await factories.makeBudgetCategoryOverride(user.id, category.id);
    await factories.makeGroup(user.id);
    await db.insert(schema.budgets).values({ salary: 5000, createdBy: user.id });
    await db
      .insert(schema.budgetOverrides)
      .values({ month: 1, year: 2026, salary: 5200, createdBy: user.id });
    await db.insert(schema.transactions).values({
      amount,
      description: 'Coffee',
      date: new Date('2026-01-15T00:00:00.000Z'),
      createdBy: user.id,
    });
    await db.insert(schema.uploads).values({
      fileName: 'file.csv',
      fileHash: 'hash-1',
      cardId: card.id,
      transactionCount: 1,
      createdBy: user.id,
    });

    await mongoDb.collection('users').insertOne({});
    await mongoDb.collection('banks').insertOne({});
    await mongoDb.collection('cards').insertOne({});
    await mongoDb.collection('accounts').insertOne({});
    await mongoDb.collection('budgetcategories').insertOne({});
    await mongoDb.collection('budgets').insertOne({});
    await mongoDb.collection('budgetoverrides').insertOne({});
    await mongoDb.collection('budgetcategoryoverrides').insertOne({});
    await mongoDb.collection('groups').insertOne({});
    await mongoDb.collection('transactions').insertOne({
      amount,
      date: new Date('2026-01-15T00:00:00.000Z'),
      createdBy: new ObjectId(),
    });
    await mongoDb.collection('uploads').insertOne({});
  };

  /**
   * Adds two fixed expenses to the seeded Mongo budget and the two categories
   * they load into. Production's categories come only from this embedded
   * array — the `budgetcategories` collection was never written to — so the
   * count check has to derive its expectation from here or it compares
   * against a number that has nothing to do with the data.
   */
  const seedFixedExpenses = async (categoriesToWrite: number) => {
    const [user] = await db.select().from(schema.users);
    await mongoDb
      .collection('budgets')
      .updateOne(
        {},
        {
          $set: {
            fixedExpenses: [
              { _id: new ObjectId(), name: 'Rent', amount: 3300 },
              { _id: new ObjectId(), name: 'gym', amount: 280 },
            ],
          },
        }
      );
    const rows = [
      { name: 'Rent', kind: 'fixed' as const, plannedAmount: 3300 },
      { name: 'gym', kind: 'fixed' as const, plannedAmount: 280 },
    ].slice(0, categoriesToWrite);
    for (const r of rows) {
      // `factories.makeBudgetCategory` resolves `household_id` (NOT NULL)
      // from the user's active membership — created earlier in
      // `seedMatchingDataset` — rather than leaving it for a raw insert to
      // violate.
      await factories.makeBudgetCategory(user.id, r);
    }
  };

  it('counts categories that came from fixedExpenses, not just the collection', async () => {
    await seedMatchingDataset();
    await seedFixedExpenses(2);

    const checks = await runVerify();
    const categories = checks.find(c => c.name === 'count budget_categories');
    expect(categories?.detail).toBe('mongo=3 postgres=3');
    expect(categories?.passed).toBe(true);
  });

  // The failure this check exists for: a load that writes the budget but drops
  // its embedded fixed expenses. Counting the `budgetcategories` collection
  // alone would report 1 == 1 and wave it through.
  it('fails when a fixedExpense was dropped by the load', async () => {
    await seedMatchingDataset();
    await seedFixedExpenses(1);

    const checks = await runVerify();
    const categories = checks.find(c => c.name === 'count budget_categories');
    expect(categories?.passed).toBe(false);
    expect(categories?.detail).toBe('mongo=3 postgres=2');
  });

  it('reports every check passing for a consistent dataset seeded in both databases', async () => {
    await seedMatchingDataset();

    const checks: Check[] = await runVerify();

    expect(checks.length).toBeGreaterThan(0);
    const failed = checks.filter(c => !c.passed);
    expect(failed).toEqual([]);
    expect(checks.every(c => c.passed)).toBe(true);

    // Every collection this ETL migrates gets its own count check.
    const countNames = checks.map(c => c.name).filter(n => n.startsWith('count '));
    expect(countNames.sort()).toEqual(
      [
        'users',
        'banks',
        'cards',
        'accounts',
        'budget_categories',
        'budgets',
        'budget_overrides',
        'budget_category_overrides',
        'groups',
        // Built from the members arrays rather than a collection of its own,
        // so it needs a count check derived the same way.
        'group_members',
        'transactions',
        'uploads',
      ]
        .map(t => `count ${t}`)
        .sort()
    );
  });

  it('fails the row-count check for the table that actually diverges, and only that one', async () => {
    await seedMatchingDataset();
    // A second, unmatched Postgres user: the load wrote a row Mongo never had.
    await factories.makeUser();

    const checks: Check[] = await runVerify();

    const userCount = checks.find(c => c.name === 'count users')!;
    expect(userCount.passed).toBe(false);
    expect(userCount.detail).toBe('mongo=1 postgres=2');

    // Every other count check, seeded 1-for-1, still passes — the failure
    // is isolated to the table that actually diverged.
    const otherCounts = checks.filter(
      c => c.name.startsWith('count ') && c.name !== 'count users'
    );
    expect(otherCounts.every(c => c.passed)).toBe(true);
  });

  it('fails the financial checksum when a transaction amount was mis-loaded', async () => {
    await seedMatchingDataset(100.0);
    // Overwrite the Postgres side's amount post-seed so this test's Mongo
    // and Postgres transactions genuinely diverge by more than a cent.
    // Only one transaction row exists at this point, so the unfiltered
    // update touches exactly it.
    await db.update(schema.transactions).set({ amount: 100.5 });

    const checks: Check[] = await runVerify();

    expect(checks.some(c => !c.passed)).toBe(true);
    const bucketCount = checks.find(c => c.name === 'checksum bucket count')!;
    // Bucket counts still agree (1 mongo bucket, 1 postgres bucket) — only
    // the value inside the bucket is wrong, so this check alone would miss
    // the defect. That's why the checksum-value check below matters.
    expect(bucketCount.passed).toBe(true);

    const checksumChecks = checks.filter(c => c.name.startsWith('checksum bucket-'));
    expect(checksumChecks).toHaveLength(1);
    expect(checksumChecks[0].passed).toBe(false);
    expect(checksumChecks[0].detail).toContain('100.00');
    expect(checksumChecks[0].detail).toContain('100.50');

    // The row-count checks are untouched by this defect: both sides still
    // have exactly one transaction. A count-only gate would have shipped
    // this bad load.
    const txCount = checks.find(c => c.name === 'count transactions')!;
    expect(txCount.passed).toBe(true);
  });

  it('buckets a near-month-boundary transaction identically in both databases regardless of the Postgres session timezone', async () => {
    // Regression guard for the timezone-mismatched checksum bucketing bug:
    // the Postgres side buckets with to_char(date, 'YYYY-MM'), which
    // resolves in the Postgres *session's* timezone unless forced to UTC;
    // the Mongo side buckets with $year/$month, which is always UTC. This
    // test picks a transaction whose UTC month and America/Toronto month
    // genuinely differ, then forces the Postgres session onto
    // America/Toronto before calling runVerify — proving the bucketing is
    // pinned to UTC rather than relying on the test container happening to
    // run in UTC.
    await seedMatchingDataset();
    const [user] = await db.select().from(schema.users);

    // 2026-02-01T02:00:00Z is 2026-01-31T21:00 in America/Toronto (EST,
    // UTC-5) — February in UTC, January in Toronto.
    const boundaryDate = new Date('2026-02-01T02:00:00.000Z');
    const boundaryAmount = 50;

    await db.insert(schema.transactions).values({
      amount: boundaryAmount,
      description: 'Late night purchase',
      date: boundaryDate,
      createdBy: user.id,
    });
    await mongoDb.collection('transactions').insertOne({
      amount: boundaryAmount,
      date: boundaryDate,
      createdBy: new ObjectId(),
    });

    await db.execute(sql.raw(`SET TIME ZONE 'America/Toronto'`));
    try {
      const checks: Check[] = await runVerify();

      // Two distinct per-user-per-month buckets on each side: January
      // (123.45) and February (50). Under the timezone bug, the Toronto
      // session would fold the boundary transaction into January on the
      // Postgres side, collapsing it to a single 173.45 bucket and
      // diverging from Mongo's two buckets.
      const bucketCount = checks.find(c => c.name === 'checksum bucket count')!;
      expect(bucketCount.detail).toBe('mongo=2 buckets, postgres=2 buckets');
      expect(bucketCount.passed).toBe(true);

      const bucketChecks = checks.filter(c => c.name.startsWith('checksum bucket-'));
      expect(bucketChecks).toHaveLength(2);
      expect(bucketChecks.every(c => c.passed)).toBe(true);
    } finally {
      // Reset so later tests in this file (and this file's own count/orphan
      // checks, which don't care about timezone) aren't affected.
      await db.execute(sql.raw(`SET TIME ZONE 'UTC'`));
    }
  });

  it('returns real JS numbers — not strings — for every raw-SQL count and sum', async () => {
    // Regression guard for a dropped ::int / ::float8 cast. node-postgres
    // returns COUNT() as a bigint string and SUM(numeric) as a numeric
    // string unless the query casts explicitly; sql<number> is a
    // compile-time assertion only, not a runtime one. A test that only
    // checks `passed: true` can miss a dropped cast because
    // compareChecksums's arithmetic (`m - p`, `.sort((a,b) => a-b)`)
    // silently coerces a string operand back to a number when the values
    // happen to agree — so this test inspects the actual values runVerify's
    // own db.execute calls resolved to, not just pass/fail.
    await seedMatchingDataset();

    const executeSpy = jest.spyOn(db, 'execute');
    await runVerify();
    const resolved = await Promise.all(
      executeSpy.mock.results.map(r => r.value as Promise<unknown>)
    );
    executeSpy.mockRestore();

    // db.execute() resolves to the raw node-postgres QueryResult, not an
    // array of rows — the actual rows live on `.rows`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = resolved.flatMap((r: any) => r?.rows ?? []);
    const countRows = rows.filter(
      r => r && Object.prototype.hasOwnProperty.call(r, 'count')
    );
    const totalRows = rows.filter(
      r => r && Object.prototype.hasOwnProperty.call(r, 'total')
    );

    // Sanity: this dataset actually produced rows to check the type of.
    expect(countRows.length).toBeGreaterThan(0);
    expect(totalRows.length).toBeGreaterThan(0);

    for (const row of countRows) {
      expect(typeof row.count).toBe('number');
    }
    for (const row of totalRows) {
      expect(typeof row.total).toBe('number');
    }
  });
});
