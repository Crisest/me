import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { requestLogger } from '../../middleware/requestLogger';
import { errorHandler } from '../../middleware/errorHandler';
import budgetRoutes from './budget.routes';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { authedAgent } from '../../../test/helpers/auth';
import { makeUser, makeBudgetCategory } from '../../../test/helpers/factories';
import { db } from '../../db/client';
import { budgets } from '../../db/schema';

/**
 * A minimal app that mounts only the budget router, rather than the full
 * `src/app.ts` — the latter pulls in `plaid.service.ts`, which still imports
 * a deleted Mongoose model (`bank.model.ts`) and cannot load until that
 * module is converted (separate, out-of-scope task). This app carries
 * exactly the middleware the budget routes need: cookies, JSON body
 * parsing, request logging (controllers call `req.log`), and the shared
 * error handler (maps AppError / Postgres SQLSTATE codes to responses).
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

let userId: string;
let agent: ReturnType<typeof authedAgent>;

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
  agent = authedAgent(app, userId);
  await db.insert(budgets).values({ salary: 5000, createdBy: userId });
});

describe('Budget category routes — auth', () => {
  it('GET /budget/categories without a JWT returns 401', async () => {
    const res = await request(app).get('/budget/categories');
    expect(res.status).toBe(401);
  });

  it('GET /budget/summary without a JWT returns 401', async () => {
    const res = await request(app).get('/budget/summary?month=5&year=2026');
    expect(res.status).toBe(401);
  });
});

describe('POST /budget/categories', () => {
  it('creates a category', async () => {
    const res = await agent
      .post('/budget/categories')
      .send({ name: 'Groceries', kind: 'flexible', plannedAmount: 600 });

    expect(res.status).toBe(201);
    expect(res.body.category).toMatchObject({ name: 'Groceries', kind: 'flexible', plannedAmount: 600 });
  });

  it('rejects an unknown kind with 400', async () => {
    const res = await agent
      .post('/budget/categories')
      .send({ name: 'Nope', kind: 'weird', plannedAmount: 10 });

    expect(res.status).toBe(400);
  });

  it('rejects a missing name with 400', async () => {
    const res = await agent
      .post('/budget/categories')
      .send({ kind: 'flexible', plannedAmount: 10 });

    expect(res.status).toBe(400);
  });

  it('rejects a negative plannedAmount on a fixed category with 400 (not 500)', async () => {
    const res = await agent
      .post('/budget/categories')
      .send({ name: 'Rent', kind: 'fixed', plannedAmount: -100 });

    // resolvePlannedAmount() in the service rejects any fixed/flexible
    // plannedAmount <= 0 with AppError(400) before a row is ever inserted,
    // so this never actually reaches the planned_amount CHECK constraint —
    // but if it did, errorHandler's 23514 -> 400 mapping would still hold
    // the response class (see src/middleware/errorHandler.test.ts).
    expect(res.status).toBe(400);
  });

  it('accepts a negative plannedAmount on an ignored category and stores it as 0', async () => {
    const res = await agent
      .post('/budget/categories')
      .send({ name: 'Transfers', kind: 'ignored', plannedAmount: -500 });

    expect(res.status).toBe(201);
    expect(res.body.category.plannedAmount).toBe(0);
  });
});

describe('GET /budget/categories', () => {
  it('returns only the caller categories', async () => {
    const other = await makeUser();
    await makeBudgetCategory(userId, { name: 'Mine' });
    await makeBudgetCategory(other.id, { name: 'Theirs' });

    const res = await agent.get('/budget/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].name).toBe('Mine');
  });
});

describe('PATCH and DELETE /budget/categories/:id', () => {
  it('updates a category', async () => {
    const cat = await makeBudgetCategory(userId, { name: 'Old', plannedAmount: 100 });

    const res = await agent.patch(`/budget/categories/${cat.id}`).send({ name: 'New' });

    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('New');
  });

  it('404s when updating another user category', async () => {
    const other = await makeUser();
    const cat = await makeBudgetCategory(other.id);

    const res = await agent.patch(`/budget/categories/${cat.id}`).send({ name: 'Hijacked' });

    expect(res.status).toBe(404);
  });

  it('deletes a category', async () => {
    const cat = await makeBudgetCategory(userId);

    const res = await agent.delete(`/budget/categories/${cat.id}`);

    expect(res.status).toBe(204);
  });
});

describe('category overrides', () => {
  it('sets and clears a per-month override', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible', plannedAmount: 100 });

    const put = await agent
      .put(`/budget/categories/${cat.id}/override`)
      .send({ month: 12, year: 2026, plannedAmount: 900 });
    expect(put.status).toBe(200);
    expect(put.body.override.plannedAmount).toBe(900);

    const del = await agent
      .delete(`/budget/categories/${cat.id}/override?month=12&year=2026`);
    expect(del.status).toBe(204);
  });

  it('rejects an override on an ignored category with 400', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'ignored', plannedAmount: 0 });

    const res = await agent
      .put(`/budget/categories/${cat.id}/override`)
      .send({ month: 12, year: 2026, plannedAmount: 900 });

    expect(res.status).toBe(400);
  });
});

describe('GET /budget/summary', () => {
  it('returns the month summary', async () => {
    await makeBudgetCategory(userId, { name: 'Rent', kind: 'fixed', plannedAmount: 1800 });

    const res = await agent.get('/budget/summary?month=5&year=2026');

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ month: 5, year: 2026, income: 5000 });
    expect(res.body.summary.categories[0]).toMatchObject({ name: 'Rent', cost: 1800 });
  });

  it('rejects a missing month with 400', async () => {
    const res = await agent.get('/budget/summary?year=2026');
    expect(res.status).toBe(400);
  });
});
