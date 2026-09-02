import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { requestLogger } from '../../middleware/requestLogger';
import { errorHandler } from '../../middleware/errorHandler';
import transactionsRoutes from './transaction.routes';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { authedAgent, signTestJwt } from '../../../test/helpers/auth';
import {
  makeUser,
  makeBank,
  makeCard,
  makeTransaction,
  makeHousehold,
  makeHouseholdMember,
  makeBudgetCategory,
} from '../../../test/helpers/factories';
import { setTransactionCategory } from './transaction.service';

/**
 * A minimal app that mounts only the transactions router, rather than the
 * full `src/app.ts` — the latter pulls in `plaid.service.ts`, which still
 * imports a deleted Mongoose model and cannot load until that module is
 * converted (separate, out-of-scope task). This app carries exactly the
 * middleware the transactions routes need: cookies, JSON body parsing,
 * request logging (controllers call `req.log`), and the shared error
 * handler.
 */
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

afterEach(truncateAll);
afterAll(closeTestDb);

describe('Transactions routes — auth', () => {
  it('GET /transactions without a JWT cookie returns 401', async () => {
    const res = await request(app).get('/transactions');
    expect(res.status).toBe(401);
  });

  it('POST /transactions/bulk without a JWT cookie returns 401', async () => {
    const res = await request(app).post('/transactions/bulk').send({});
    expect(res.status).toBe(401);
  });

  it('rejects a malformed JWT cookie with 401', async () => {
    const res = await request(app)
      .get('/transactions')
      .set('Cookie', ['jwt=not-a-real-token']);
    expect(res.status).toBe(401);
  });

  it('rejects a token for a user that no longer exists with 404', async () => {
    const ghostUserId = uuidv7();
    const token = signTestJwt(ghostUserId);
    const res = await request(app)
      .get('/transactions')
      .set('Cookie', [`jwt=${token}`]);
    expect(res.status).toBe(404);
  });
});

describe('Transactions routes — validation', () => {
  it('POST /transactions/bulk with empty transactions array returns 400', async () => {
    const user = await makeUser();
    const agent = authedAgent(app, user.id);
    const res = await agent.post('/transactions/bulk').send({
      transactions: [],
      cardId: uuidv7(),
      fileName: 'a.csv',
      fileHash: 'h1',
    });
    expect(res.status).toBe(400);
  });

  it('POST /transactions/bulk missing cardId returns 400', async () => {
    const user = await makeUser();
    const agent = authedAgent(app, user.id);
    const res = await agent.post('/transactions/bulk').send({
      transactions: [{ amount: 1, description: 'x', date: '2026-05-10' }],
      fileName: 'a.csv',
      fileHash: 'h1',
    });
    expect(res.status).toBe(400);
  });
});

describe('Transactions routes — happy path & isolation', () => {
  it("POST /transactions/bulk then GET /transactions returns only this user's rows", async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    const bankA = await makeBank(userA.id);
    const cardA = await makeCard(userA.id, bankA.id);

    const bankB = await makeBank(userB.id);
    const cardB = await makeCard(userB.id, bankB.id);
    await makeTransaction(userB.id, { cardId: cardB.id, description: 'B-only' });

    const agentA = authedAgent(app, userA.id);
    const postRes = await agentA.post('/transactions/bulk').send({
      transactions: [
        { amount: 10, description: 'A1', date: '2026-05-10' },
        { amount: 20, description: 'A2', date: '2026-05-11' },
      ],
      cardId: cardA.id,
      fileName: 'a.csv',
      fileHash: 'hash-A',
    });
    expect([200, 201, 204]).toContain(postRes.status);

    const getRes = await agentA.get('/transactions');
    expect(getRes.status).toBe(200);
    const descriptions = (getRes.body as Array<{ description: string }>).map(t => t.description);
    expect(descriptions).toEqual(expect.arrayContaining(['A1', 'A2']));
    expect(descriptions).not.toContain('B-only');
  });

  it('POST /transactions/bulk twice with the same fileHash documents current behavior', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    const card = await makeCard(user.id, bank.id);
    const agent = authedAgent(app, user.id);

    const body = {
      transactions: [{ amount: 10, description: 'dup', date: '2026-05-10' }],
      cardId: card.id,
      fileName: 'dup.csv',
      fileHash: 'same-hash',
    };

    const first = await agent.post('/transactions/bulk').send(body);
    const second = await agent.post('/transactions/bulk').send(body);

    expect([200, 201, 204]).toContain(first.status);
    expect([200, 201, 204, 409, 500]).toContain(second.status);
  });
});

describe('GET /transactions — query validation and scope', () => {
  it('rejects a malformed categoryId with 400', async () => {
    const user = await makeUser();
    const agent = authedAgent(app, user.id);

    const res = await agent.get('/transactions?categoryId=not-a-uuid');

    expect(res.status).toBe(400);
  });

  it('scope=household returns another member\'s transactions with ownerEmail populated', async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    const household = await makeHousehold(userA.id);
    await makeHouseholdMember(household.id, userA.id);
    await makeHouseholdMember(household.id, userB.id);

    await makeTransaction(userA.id, { description: 'A-txn', date: new Date() });
    await makeTransaction(userB.id, { description: 'B-txn', date: new Date() });

    const agentA = authedAgent(app, userA.id);
    const res = await agentA.get('/transactions?scope=household');

    expect(res.status).toBe(200);
    const descriptions = (res.body as Array<{ description: string; ownerEmail?: string }>).map(
      t => t.description
    );
    expect(descriptions).toEqual(expect.arrayContaining(['A-txn', 'B-txn']));
    expect(
      (res.body as Array<{ ownerEmail?: string }>).every(t => Boolean(t.ownerEmail))
    ).toBe(true);
  });

  it('scope=mine returns only the caller\'s transactions', async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    const household = await makeHousehold(userA.id);
    await makeHouseholdMember(household.id, userA.id);
    await makeHouseholdMember(household.id, userB.id);

    await makeTransaction(userA.id, { description: 'A-txn', date: new Date() });
    await makeTransaction(userB.id, { description: 'B-txn', date: new Date() });

    const agentA = authedAgent(app, userA.id);
    const res = await agentA.get('/transactions?scope=mine');

    expect(res.status).toBe(200);
    const descriptions = (res.body as Array<{ description: string }>).map(t => t.description);
    expect(descriptions).toEqual(['A-txn']);
  });

  it('defaults to scope=mine when no scope is given', async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    const household = await makeHousehold(userA.id);
    await makeHouseholdMember(household.id, userA.id);
    await makeHouseholdMember(household.id, userB.id);

    await makeTransaction(userA.id, { description: 'A-txn', date: new Date() });
    await makeTransaction(userB.id, { description: 'B-txn', date: new Date() });

    const agentA = authedAgent(app, userA.id);
    const res = await agentA.get('/transactions');

    expect(res.status).toBe(200);
    const descriptions = (res.body as Array<{ description: string }>).map(t => t.description);
    expect(descriptions).toEqual(['A-txn']);
  });

  it('categoryId filters to tagged transactions only', async () => {
    const user = await makeUser();
    const household = await makeHousehold(user.id);
    await makeHouseholdMember(household.id, user.id);
    const category = await makeBudgetCategory(user.id, {
      kind: 'flexible',
      plannedAmount: 100,
      householdId: household.id,
    });

    const tagged = await makeTransaction(user.id, {
      amount: 50,
      description: 'tagged',
      date: new Date(),
    });
    await makeTransaction(user.id, {
      amount: 20,
      description: 'untagged',
      date: new Date(),
    });

    await setTransactionCategory(
      {
        householdId: household.id,
        members: [{ userId: user.id, from: new Date('2000-01-01'), to: null }],
      },
      user.id,
      tagged.id,
      { categoryId: category.id }
    );

    const agent = authedAgent(app, user.id);
    const res = await agent.get(`/transactions?categoryId=${category.id}`);

    expect(res.status).toBe(200);
    const descriptions = (res.body as Array<{ description: string }>).map(t => t.description);
    expect(descriptions).toEqual(['tagged']);
  });
});
