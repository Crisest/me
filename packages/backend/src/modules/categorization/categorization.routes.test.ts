import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { requestLogger } from '../../middleware/requestLogger';
import { errorHandler } from '../../middleware/errorHandler';
import transactionsRoutes from '../transactions/transaction.routes';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { authedAgent } from '../../../test/helpers/auth';
import {
  makeUser,
  makeBudgetCategory,
  makeTransaction,
  makeCategorySuggestion,
} from '../../../test/helpers/factories';
import { createHousehold } from '../households/household.service';
import { db } from '../../db/client';
import { householdMembers, transactionCategories } from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

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

describe('POST /transactions/suggestions', () => {
  it('401s without a session', async () => {
    await request(app)
      .post('/transactions/suggestions')
      .send({ month: 3, year: 2026 })
      .expect(401);
  });

  it('400s on a missing month', async () => {
    await agent.post('/transactions/suggestions').send({ year: 2026 }).expect(400);
  });

  it('400s on an out-of-range month', async () => {
    await agent
      .post('/transactions/suggestions')
      .send({ month: 13, year: 2026 })
      .expect(400);
  });
});

describe('GET /transactions/suggestions', () => {
  it('returns the pending suggestions for the month', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible', householdId });
    const txn = await makeTransaction(userId, {
      amount: 30,
      date: new Date('2026-03-05'),
    });
    await makeCategorySuggestion(txn.id, cat.id, householdId, userId);

    const res = await agent
      .get('/transactions/suggestions?month=3&year=2026')
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('pending');
  });
});

describe('POST /transactions/suggestions/resolve', () => {
  it('applies a real tag through the shared write path', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible', householdId });
    const txn = await makeTransaction(userId, {
      amount: 30,
      date: new Date('2026-03-05'),
    });
    const suggestion = await makeCategorySuggestion(txn.id, cat.id, householdId, userId);

    const res = await agent
      .post('/transactions/suggestions/resolve')
      .send({ items: [{ id: suggestion.id, action: 'accept' }] })
      .expect(200);

    expect(res.body).toEqual([{ id: suggestion.id, ok: true }]);

    const [row] = await db
      .select()
      .from(transactionCategories)
      .where(
        and(
          eq(transactionCategories.transactionId, txn.id),
          isNull(transactionCategories.deletedAt)
        )
      );
    expect(row).toBeDefined();
    expect(row.categoryId).toBe(cat.id);
  });

  it("reports ok:false for another household's suggestion id", async () => {
    const otherUser = await makeUser();
    const otherHousehold = await createHousehold('Other', otherUser.id);
    const otherCat = await makeBudgetCategory(otherUser.id, {
      kind: 'flexible',
      householdId: otherHousehold.id,
    });
    const otherTxn = await makeTransaction(otherUser.id, {
      amount: 30,
      date: new Date('2026-03-05'),
    });
    const otherSuggestion = await makeCategorySuggestion(
      otherTxn.id,
      otherCat.id,
      otherHousehold.id,
      otherUser.id
    );

    const res = await agent
      .post('/transactions/suggestions/resolve')
      .send({ items: [{ id: otherSuggestion.id, action: 'accept' }] })
      .expect(200);

    expect(res.body[0].ok).toBe(false);
  });

  it('400s on an empty items array', async () => {
    await agent.post('/transactions/suggestions/resolve').send({ items: [] }).expect(400);
  });
});
