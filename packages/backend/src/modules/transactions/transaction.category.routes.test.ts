import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { requestLogger } from '../../middleware/requestLogger';
import { errorHandler } from '../../middleware/errorHandler';
import transactionsRoutes from './transaction.routes';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { authedAgent } from '../../../test/helpers/auth';
import { makeUser, makeBudgetCategory, makeTransaction } from '../../../test/helpers/factories';
import { createHousehold } from '../households/household.service';
import { db } from '../../db/client';
import { householdMembers } from '../../db/schema';
import { eq } from 'drizzle-orm';

const buildApp = (): Application => {
  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/transactions', transactionsRoutes);
  app.use(errorHandler);
  return app;
};

const app = buildApp();

let userId: string;
let householdId: string;
let agent: ReturnType<typeof authedAgent>;

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
  // resolveBudgetScope auto-creates a household for a user with no active
  // membership; creating it explicitly here lets tests scope categories to
  // it via householdId.
  const household = await createHousehold('Home', userId);
  householdId = household.id;
  // resolveBudgetScope derives each member's tenure window from
  // householdMembers.createdAt; backdate it so this test's transactions
  // (some dated well in the past) fall inside the window.
  await db
    .update(householdMembers)
    .set({ createdAt: new Date('2000-01-01') })
    .where(eq(householdMembers.userId, userId));
  agent = authedAgent(app, userId);
});

describe('PATCH /transactions/:id/category', () => {
  it('returns 401 without a JWT cookie', async () => {
    const someId = uuidv7();
    const res = await request(app)
      .patch(`/transactions/${someId}/category`)
      .send({ categoryId: null });

    expect(res.status).toBe(401);
  });

  it('rejects a non-hex categoryId with 400', async () => {
    const txn = await makeTransaction(userId);

    const res = await agent
      .patch(`/transactions/${txn.id}/category`)
      .send({ categoryId: 'not-a-hex' });

    expect(res.status).toBe(400);
  });

  it('tags a transaction to a category', async () => {
    const cat = await makeBudgetCategory(userId, {
      kind: 'flexible',
      plannedAmount: 600,
      householdId,
    });
    const txn = await makeTransaction(userId, { amount: 50 });

    const res = await agent
      .patch(`/transactions/${txn.id}/category`)
      .send({ categoryId: cat.id });

    expect(res.status).toBe(200);
  });

  it('untags with a null categoryId', async () => {
    const cat = await makeBudgetCategory(userId);
    const txn = await makeTransaction(userId, { categoryId: cat.id });

    const res = await agent
      .patch(`/transactions/${txn.id}/category`)
      .send({ categoryId: null });

    expect(res.status).toBe(200);
  });

  it('409s on a second transaction for a fixed category in one month', async () => {
    const cat = await makeBudgetCategory(userId, {
      kind: 'fixed',
      plannedAmount: 1800,
      householdId,
    });
    const first = await makeTransaction(userId, { date: new Date('2026-05-03') });
    const second = await makeTransaction(userId, { date: new Date('2026-05-20') });

    await agent
      .patch(`/transactions/${first.id}/category`)
      .send({ categoryId: cat.id });

    const res = await agent
      .patch(`/transactions/${second.id}/category`)
      .send({ categoryId: cat.id });

    expect(res.status).toBe(409);
  });
});

describe('PATCH /transactions/:id/category — not-found / cross-tenant / bad id', () => {
  it('returns 404 for a non-existent transaction', async () => {
    const missingId = uuidv7();

    const res = await agent
      .patch(`/transactions/${missingId}/category`)
      .send({ categoryId: null });

    expect(res.status).toBe(404);
  });

  it("returns 404 for another user's transaction (no leak)", async () => {
    const userB = await makeUser();
    const txnB = await makeTransaction(userB.id);

    const res = await agent
      .patch(`/transactions/${txnB.id}/category`)
      .send({ categoryId: null });

    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id in :id', async () => {
    const res = await agent
      .patch('/transactions/not-a-valid-id/category')
      .send({ categoryId: null });

    expect(res.status).toBe(400);
  });
});
