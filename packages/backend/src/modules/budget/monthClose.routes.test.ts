import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { requestLogger } from '../../middleware/requestLogger';
import { errorHandler } from '../../middleware/errorHandler';
import budgetRoutes from './budget.routes';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { authedAgent } from '../../../test/helpers/auth';
import {
  makeUser,
  makeTransaction,
  makeBudgetCategory,
  makeTransactionCategory,
} from '../../../test/helpers/factories';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { budgets, budgetOverrides, householdMembers } from '../../db/schema';
import { createHousehold } from '../households/household.service';

/**
 * A minimal app mounting only the budget router, for the same reason
 * budgetCategory.routes.test.ts does: src/app.ts pulls in modules unrelated
 * to this surface.
 */
const buildApp = (): Application => {
  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/budget', budgetRoutes);
  app.use(errorHandler);
  return app;
};

const app = buildApp();

afterEach(truncateAll);
afterAll(closeTestDb);

const MARCH = new Date(2026, 2, 10);

const readyUser = async () => {
  const user = await makeUser();
  const household = await createHousehold('Home', user.id);
  // `resolveBudgetScope` derives ScopeMember.from from
  // household_members.created_at, which defaults to "now" — so a hardcoded
  // past month (MARCH 2026) would have no covering member unless the
  // fixture's tenure start is pinned explicitly, well before the month
  // under test. Matches the same fix in budgetCategory.routes.test.ts.
  await db
    .update(householdMembers)
    .set({ createdAt: new Date('2020-01-01') })
    .where(eq(householdMembers.userId, user.id));
  await db.insert(budgets).values({ salary: 5000, createdBy: user.id });
  await db
    .insert(budgetOverrides)
    .values({ month: 3, year: 2026, salary: 4700, createdBy: user.id });
  const category = await makeBudgetCategory(user.id, {
    kind: 'flexible',
    plannedAmount: 600,
    householdId: household.id,
  });
  const txn = await makeTransaction(user.id, { amount: 61.25, date: MARCH });
  await makeTransactionCategory(txn.id, category.id, household.id, user.id);
  return { user, household, agent: authedAgent(app, user.id) };
};

describe('POST /budget/close', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/budget/close')
      .send({ month: 3, year: 2026 });
    expect(res.status).toBe(401);
  });

  it('rejects a month outside 1..12', async () => {
    const { agent } = await readyUser();
    const res = await agent.post('/budget/close').send({ month: 13, year: 2026 });
    expect(res.status).toBe(400);
  });

  it('closes a ready month and returns the snapshot', async () => {
    const { agent, user } = await readyUser();

    const res = await agent.post('/budget/close').send({ month: 3, year: 2026 });

    expect(res.status).toBe(201);
    expect(res.body.snapshot).toMatchObject({
      month: 3,
      year: 2026,
      version: 1,
      closedBy: user.id,
    });
    expect(res.body.snapshot.transactions).toHaveLength(1);
    expect(typeof res.body.snapshot.closedAt).toBe('number');
  });

  it('refuses a month that is not ready, naming what is missing', async () => {
    const { agent, user } = await readyUser();
    await makeTransaction(user.id, { amount: 95, date: MARCH });

    const res = await agent.post('/budget/close').send({ month: 3, year: 2026 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('untagged');
  });

  it('refuses a second close with 409', async () => {
    const { agent } = await readyUser();
    await agent.post('/budget/close').send({ month: 3, year: 2026 });

    const res = await agent.post('/budget/close').send({ month: 3, year: 2026 });

    expect(res.status).toBe(409);
  });
});

describe('GET /budget/snapshot', () => {
  it('returns null for an open month', async () => {
    const { agent } = await readyUser();
    const res = await agent.get('/budget/snapshot?month=3&year=2026');
    expect(res.status).toBe(200);
    expect(res.body.snapshot).toBeNull();
  });

  it('returns the snapshot for a closed month', async () => {
    const { agent } = await readyUser();
    await agent.post('/budget/close').send({ month: 3, year: 2026 });

    const res = await agent.get('/budget/snapshot?month=3&year=2026');

    expect(res.status).toBe(200);
    expect(res.body.snapshot.month).toBe(3);
    expect(res.body.snapshot.summary.income).toBe(4700);
  });

  it('does not serve another household\'s snapshot', async () => {
    const { agent } = await readyUser();
    await agent.post('/budget/close').send({ month: 3, year: 2026 });

    const stranger = await makeUser();
    await createHousehold('Elsewhere', stranger.id);
    const res = await authedAgent(app, stranger.id).get(
      '/budget/snapshot?month=3&year=2026'
    );

    expect(res.body.snapshot).toBeNull();
  });
});

describe('GET /budget/summary — close state', () => {
  it('reports an open month and what is blocking it', async () => {
    const user = await makeUser();
    await createHousehold('Home', user.id);
    await db
      .update(householdMembers)
      .set({ createdAt: new Date('2020-01-01') })
      .where(eq(householdMembers.userId, user.id));
    const agent = authedAgent(app, user.id);

    const res = await agent.get('/budget/summary?month=3&year=2026');

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ month: 3, year: 2026 });
    expect(res.body.close).toMatchObject({ closed: false, lateTransactionCount: 0 });
    // No income filed for March, so the caller themselves are a blocker.
    expect(res.body.close.readiness.canClose).toBe(false);
    expect(res.body.close.readiness.membersMissingIncome).toHaveLength(1);
  });

  it('reports a closed month, and never says it is ready to close again', async () => {
    const { agent, user } = await readyUser();
    const closed = await agent.post('/budget/close').send({ month: 3, year: 2026 });
    expect(closed.status).toBe(201);

    const res = await agent.get('/budget/summary?month=3&year=2026');

    expect(res.body.close.closed).toBe(true);
    expect(res.body.close.snapshotId).toBe(closed.body.snapshot.id);
    expect(res.body.close.closedBy).toBe(user.id);
    // A closed month's frozen summary has nothing untagged and every member
    // marked actual, so readiness would otherwise compute `true` — which reads
    // as "go ahead and close it" for a month that is already closed.
    expect(res.body.close.readiness.canClose).toBe(false);
  });

  it('omits the close state for a single-member view', async () => {
    // `close` answers a household question. Computing it for a `mine` request
    // would mean running the heaviest read in the app twice on every
    // transactions-page load, to populate a field that page never reads.
    const { agent } = await readyUser();

    const res = await agent.get('/budget/summary?month=3&year=2026&scope=mine');

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.close).toBeUndefined();
  });
});
