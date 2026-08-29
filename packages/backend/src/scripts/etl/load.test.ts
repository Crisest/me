import type { MongoMemoryServer as MongoMemoryServerType } from 'mongodb-memory-server';
import type { MongoClient as MongoClientType, Db as MongoDbType } from 'mongodb';
import { ObjectId } from 'mongodb';
import { IdMap } from './id-map';

describe('IdMap', () => {
  it('assigns a distinct uuid v7 per source id', () => {
    const map = new IdMap();
    const a = map.assign('users', '507f1f77bcf86cd799439011');
    const b = map.assign('users', '507f1f77bcf86cd799439012');
    expect(a).not.toBe(b);
    expect(a).toMatch(/-7[0-9a-f]{3}-/);
  });

  it('is stable for the same source id', () => {
    const map = new IdMap();
    const first = map.assign('users', 'abc');
    expect(map.assign('users', 'abc')).toBe(first);
    expect(map.resolve('users', 'abc')).toBe(first);
  });

  it('keeps namespaces separate per collection', () => {
    const map = new IdMap();
    const asUser = map.assign('users', 'same-id');
    const asCard = map.assign('cards', 'same-id');
    expect(asUser).not.toBe(asCard);
  });

  // The critical invariant: never return a NULL, never skip a row.
  it('throws on an unresolvable required reference', () => {
    const map = new IdMap();
    expect(() => map.resolve('cards', 'never-seen')).toThrow(
      /unresolvable reference/i
    );
  });

  it('resolveOptional returns null for a nullish input', () => {
    const map = new IdMap();
    expect(map.resolveOptional('cards', null)).toBeNull();
    expect(map.resolveOptional('cards', undefined)).toBeNull();
  });

  // An optional FK pointing at something that does not exist is still a bug,
  // not a NULL — the audit is what decides to null it, not the loader.
  it('resolveOptional still throws on a present but unknown reference', () => {
    const map = new IdMap();
    expect(() => map.resolveOptional('cards', 'never-seen')).toThrow(
      /unresolvable reference/i
    );
  });

  it('reports how many ids it holds per collection', () => {
    const map = new IdMap();
    map.assign('users', 'a');
    map.assign('users', 'b');
    expect(map.size('users')).toBe(2);
    expect(map.size('cards')).toBe(0);
  });
});

/**
 * `runLoad` reads its Mongo connection string from process.env.MONGODB_URI
 * via `../../config/env`, which captures `process.env` into a module-level
 * constant the first time it is imported. `packages/backend/.env` may hold
 * real (production) credentials, so we must never let that module load
 * before we have pointed MONGODB_URI at a disposable in-memory Mongo.
 *
 * This file only statically imports `./id-map`, which has no dependency on
 * env config. Everything that transitively touches `../../config/env` —
 * `./load`, `../../db/client`, `../../db/schema`, `../../../test/setup` — is
 * `require`d lazily inside `beforeAll`, after MONGODB_URI is overridden. Each
 * Jest test file already gets its own fresh module registry, so this is
 * enough; no `jest.resetModules()` is needed.
 */
describe('runLoad', () => {
  jest.setTimeout(120_000);

  let mongod: MongoMemoryServerType;
  let mongoUri: string;
  let mongoClient: MongoClientType;
  let mongoDb: MongoDbType;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runLoad: (options?: { dryRun?: boolean }) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let schema: any;
  let truncateAll: () => Promise<void>;
  let closeTestDb: () => Promise<void>;

  beforeAll(async () => {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri('portfolio_etl_test');
    process.env.MONGODB_URI = mongoUri;

    const { MongoClient } = require('mongodb');
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    mongoDb = mongoClient.db();

    ({ runLoad } = require('./load'));
    ({ db } = require('../../db/client'));
    schema = require('../../db/schema');
    ({ truncateAll, closeTestDb } = require('../../../test/setup'));
  });

  afterAll(async () => {
    await mongoClient?.close();
    await mongod?.stop();
    // Same convention as every other suite: this file's require of
    // '../../db/client' created its own Pool instance (Jest gives each test
    // file a fresh module registry), so it must close its own pool rather
    // than relying on another suite's afterAll to have done it.
    await closeTestDb();
  });

  beforeEach(async () => {
    await truncateAll();
    const collections = await mongoDb.listCollections().toArray();
    for (const c of collections) {
      await mongoDb.collection(c.name).deleteMany({});
    }
  });

  const oid = () => new ObjectId();

  // Production has no `budgetcategories` collection at all — categories are a
  // post-Mongo feature. Every category there has to come from the
  // `fixedExpenses` array embedded on a budget, or the migration loses them.
  it('maps each embedded fixedExpense to a fixed budget category', async () => {
    const userId = oid();
    const budgetId = oid();
    const rentId = oid();
    const gymId = oid();

    await mongoDb.collection('users').insertOne({
      _id: userId,
      email: 'a@example.com',
      passwordHash: 'h',
      name: 'A',
      createdAt: new Date(),
    });
    await mongoDb.collection('budgets').insertOne({
      _id: budgetId,
      salary: 8000,
      createdBy: userId,
      fixedExpenses: [
        { _id: rentId, name: 'Rent', amount: 3300 },
        { _id: gymId, name: 'gym', amount: 280 },
      ],
      createdAt: new Date(),
    });

    const report = await runLoad();
    expect(report.budgetcategories).toEqual({ read: 2, written: 2 });

    const rows = await db.select().from(schema.budgetCategories);
    expect(rows).toHaveLength(2);

    const byName = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows.map((r: any) => [r.name, r])
    );
    expect(byName.Rent.plannedAmount).toBe(3300);
    expect(byName.Rent.kind).toBe('fixed');
    expect(byName.Rent.color).toBeNull();
    expect(byName.gym.plannedAmount).toBe(280);

    const userRows = await db.select().from(schema.users);
    expect(byName.Rent.createdBy).toBe(userRows[0].id);
    // The budget itself still loads, minus the embedded array.
    const budgetRows = await db.select().from(schema.budgets);
    expect(budgetRows).toHaveLength(1);
    expect(budgetRows[0].salary).toBe(8000);
  });

  // The check constraint would reject this anyway, but an opaque constraint
  // violation rolls back the whole load without saying which row caused it.
  it('fails by name on a fixedExpense with a non-positive amount', async () => {
    const userId = oid();
    await mongoDb.collection('users').insertOne({
      _id: userId,
      email: 'a@example.com',
      passwordHash: 'h',
      name: 'A',
      createdAt: new Date(),
    });
    await mongoDb.collection('budgets').insertOne({
      _id: oid(),
      salary: 8000,
      createdBy: userId,
      fixedExpenses: [{ _id: oid(), name: 'Broken', amount: 0 }],
      createdAt: new Date(),
    });

    await expect(runLoad()).rejects.toThrow(/Broken.*positive number/s);
    expect(await db.select().from(schema.budgetCategories)).toHaveLength(0);
  });

  it('loads a full dataset in FK order, resolving every reference through the id map', async () => {
    const userId = oid();
    const bankId = oid();
    const cardId = oid();
    const accountId = oid();
    const categoryId = oid();
    const budgetId = oid();
    const budgetOverrideId = oid();
    const bcoId = oid();
    const groupId = oid();
    const txId = oid();
    const uploadId = oid();
    const groupCreatedAt = new Date('2024-02-01T00:00:00.000Z');

    await mongoDb.collection('users').insertOne({
      _id: userId,
      email: 'a@example.com',
      passwordHash: 'hash',
      name: 'Ada',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      groups: [groupId],
    });
    await mongoDb.collection('banks').insertOne({
      _id: bankId,
      name: 'Bank',
      createdBy: userId,
      isPlaidLinked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await mongoDb.collection('cards').insertOne({
      _id: cardId,
      name: 'Card',
      bankId,
      createdBy: userId,
      createdAt: new Date(),
    });
    await mongoDb.collection('accounts').insertOne({
      _id: accountId,
      bankId,
      plaidAccountId: 'plaid-acct-1',
      name: 'Checking',
      type: 'depository',
      mask: '0000',
      createdBy: userId,
      createdAt: new Date(),
    });
    await mongoDb.collection('budgetcategories').insertOne({
      _id: categoryId,
      name: 'Groceries',
      kind: 'flexible',
      plannedAmount: 100,
      createdBy: userId,
      createdAt: new Date(),
    });
    await mongoDb.collection('budgets').insertOne({
      _id: budgetId,
      salary: 5000,
      createdBy: userId,
      createdAt: new Date(),
    });
    await mongoDb.collection('budgetoverrides').insertOne({
      _id: budgetOverrideId,
      month: 1,
      year: 2026,
      salary: 5200,
      createdBy: userId,
      createdAt: new Date(),
    });
    await mongoDb.collection('budgetcategoryoverrides').insertOne({
      _id: bcoId,
      categoryId,
      month: 1,
      year: 2026,
      plannedAmount: 120,
      createdBy: userId,
      createdAt: new Date(),
    });
    await mongoDb.collection('groups').insertOne({
      _id: groupId,
      name: 'Group',
      inviteCode: 'INVITE1',
      members: [userId],
      createdBy: userId,
      createdAt: groupCreatedAt,
    });
    await mongoDb.collection('transactions').insertOne({
      _id: txId,
      amount: 42.5,
      description: 'Coffee',
      date: new Date('2026-01-15T00:00:00.000Z'),
      groupId,
      cardId,
      accountId,
      categoryId,
      createdBy: userId,
      createdAt: new Date(),
    });
    await mongoDb.collection('uploads').insertOne({
      _id: uploadId,
      fileName: 'file.csv',
      fileHash: 'hash-1',
      cardId,
      transactionCount: 1,
      createdBy: userId,
      createdAt: new Date(),
    });

    const report = await runLoad();

    for (const table of Object.keys(report)) {
      expect(report[table].read).toBe(report[table].written);
    }
    expect(report.users).toEqual({ read: 1, written: 1 });
    expect(report.banks).toEqual({ read: 1, written: 1 });
    expect(report.cards).toEqual({ read: 1, written: 1 });
    expect(report.accounts).toEqual({ read: 1, written: 1 });
    expect(report.budgetcategories).toEqual({ read: 1, written: 1 });
    expect(report.budgets).toEqual({ read: 1, written: 1 });
    expect(report.budgetoverrides).toEqual({ read: 1, written: 1 });
    expect(report.budgetcategoryoverrides).toEqual({ read: 1, written: 1 });
    expect(report.groups).toEqual({ read: 1, written: 1 });
    expect(report.group_members).toEqual({ read: 1, written: 1 });
    expect(report.transactions).toEqual({ read: 1, written: 1 });
    expect(report.uploads).toEqual({ read: 1, written: 1 });

    const userRows = await db.select().from(schema.users);
    expect(userRows).toHaveLength(1);
    expect(userRows[0].email).toBe('a@example.com');
    // The Mongo ObjectId never carries over as the Postgres primary key.
    expect(userRows[0].id).not.toBe(String(userId));
    expect(userRows[0].id).toMatch(/-7[0-9a-f]{3}-/);

    const txRows = await db.select().from(schema.transactions);
    expect(txRows).toHaveLength(1);
    expect(txRows[0].amount).toBe(42.5);
    expect(txRows[0].createdBy).toBe(userRows[0].id);

    const bankRows = await db.select().from(schema.banks);
    expect(txRows[0].cardId).not.toBeNull();

    const cardRows = await db.select().from(schema.cards);
    expect(cardRows[0].bankId).toBe(bankRows[0].id);

    const memberRows = await db.select().from(schema.groupMembers);
    expect(memberRows).toHaveLength(1);
    // group_members.joined_at is backfilled from the group's createdAt.
    expect(memberRows[0].joinedAt.toISOString()).toBe(
      groupCreatedAt.toISOString()
    );
  });

  it('unions membership from both group.members and user.groups without duplicating an agreeing pair', async () => {
    const u1 = oid();
    const u2 = oid();
    const g = oid();
    const groupCreatedAt = new Date('2025-06-01T00:00:00.000Z');

    // u1: listed on both sides (agrees).
    // u2: listed in group.members only — a drift case the audit would flag
    // as 'resolve', but the loader still unions it in rather than dropping it.
    await mongoDb.collection('users').insertMany([
      {
        _id: u1,
        email: 'u1@example.com',
        passwordHash: 'x',
        createdAt: new Date(),
        groups: [g],
      },
      {
        _id: u2,
        email: 'u2@example.com',
        passwordHash: 'x',
        createdAt: new Date(),
        groups: [],
      },
    ]);
    await mongoDb.collection('groups').insertOne({
      _id: g,
      name: 'G',
      inviteCode: 'INVITE2',
      members: [u1, u2],
      createdBy: u1,
      createdAt: groupCreatedAt,
    });

    const report = await runLoad();

    expect(report.group_members).toEqual({ read: 2, written: 2 });
    const memberRows = await db.select().from(schema.groupMembers);
    expect(memberRows).toHaveLength(2);
    expect(
      memberRows.every(
        (r: { joinedAt: Date }) =>
          r.joinedAt.toISOString() === groupCreatedAt.toISOString()
      )
    ).toBe(true);
  });

  it('throws on an unresolvable required reference and writes nothing at all', async () => {
    const userId = oid();
    const ghostUser = oid();
    await mongoDb.collection('users').insertOne({
      _id: userId,
      email: 'a@example.com',
      passwordHash: 'x',
      createdAt: new Date(),
    });
    // References a user that does not exist in the users collection.
    await mongoDb.collection('banks').insertOne({
      _id: oid(),
      name: 'Bank',
      createdBy: ghostUser,
      createdAt: new Date(),
    });

    await expect(runLoad()).rejects.toThrow(/unresolvable reference/i);

    // The whole transaction rolled back — even the users insert that
    // happened before the failing banks insert must not be visible.
    const userRows = await db.select().from(schema.users);
    expect(userRows).toHaveLength(0);
    const bankRows = await db.select().from(schema.banks);
    expect(bankRows).toHaveLength(0);
  });

  it('dry run rolls back a fully valid load and writes nothing', async () => {
    const userId = oid();
    await mongoDb.collection('users').insertOne({
      _id: userId,
      email: 'a@example.com',
      passwordHash: 'x',
      createdAt: new Date(),
    });

    await expect(runLoad({ dryRun: true })).rejects.toThrow('DRY_RUN');

    const userRows = await db.select().from(schema.users);
    expect(userRows).toHaveLength(0);
  });
});
