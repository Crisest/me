import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import {
  connectMemoryMongo,
  disconnectMemoryMongo,
  clearAllCollections,
} from '../../../test/setup';
import { authedAgent, signTestJwt } from '../../../test/helpers/auth';
import { makeUser, makeBank, makeCard, makeTransaction } from '../../../test/helpers/factories';

// Mongoose Model.create returns _id typed as `unknown` in some configurations.
// This helper casts it to ObjectId safely.
function oid(doc: { _id: unknown }): mongoose.Types.ObjectId {
  return doc._id as mongoose.Types.ObjectId;
}

beforeAll(async () => {
  await connectMemoryMongo();
});

afterEach(async () => {
  await clearAllCollections();
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

describe('Transactions routes — auth', () => {
  it('GET /transactions without a JWT cookie returns 401', async () => {
    const res = await request(app).get('/transactions');
    expect(res.status).toBe(401);
  });

  it('POST /transactions/bulk without a JWT cookie returns 401', async () => {
    const res = await request(app).post('/transactions/bulk').send({});
    expect(res.status).toBe(401);
  });

  it('PATCH /transactions/:id/fixed-expense without a JWT cookie returns 401', async () => {
    const someId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/transactions/${someId}/fixed-expense`)
      .send({ fixedExpenseId: null });
    expect(res.status).toBe(401);
  });

  it('rejects a malformed JWT cookie with 401', async () => {
    const res = await request(app)
      .get('/transactions')
      .set('Cookie', ['jwt=not-a-real-token']);
    expect(res.status).toBe(401);
  });

  it('rejects a token for a user that no longer exists with 404', async () => {
    const ghostUserId = new mongoose.Types.ObjectId().toString();
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
    const agent = authedAgent(app, oid(user).toString());
    const res = await agent.post('/transactions/bulk').send({
      transactions: [],
      cardId: new mongoose.Types.ObjectId().toString(),
      fileName: 'a.csv',
      fileHash: 'h1',
    });
    expect(res.status).toBe(400);
  });

  it('POST /transactions/bulk missing cardId returns 400', async () => {
    const user = await makeUser();
    const agent = authedAgent(app, oid(user).toString());
    const res = await agent.post('/transactions/bulk').send({
      transactions: [{ amount: 1, description: 'x', date: '2026-05-10' }],
      fileName: 'a.csv',
      fileHash: 'h1',
    });
    expect(res.status).toBe(400);
  });

  it('PATCH /:id/fixed-expense with a non-hex fixedExpenseId returns 400', async () => {
    const user = await makeUser();
    const bank = await makeBank(oid(user).toString());
    const card = await makeCard(oid(user).toString(), oid(bank).toString());
    const txn = await makeTransaction(oid(user).toString(), oid(card).toString());
    const agent = authedAgent(app, oid(user).toString());

    const res = await agent
      .patch(`/transactions/${oid(txn)}/fixed-expense`)
      .send({ fixedExpenseId: 'not-a-hex' });
    expect(res.status).toBe(400);
  });
});

describe('Transactions routes — not-found / cross-tenant / bad ObjectId', () => {
  it('PATCH on a non-existent transaction returns 404', async () => {
    const user = await makeUser();
    const agent = authedAgent(app, oid(user).toString());
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await agent
      .patch(`/transactions/${missingId}/fixed-expense`)
      .send({ fixedExpenseId: null });
    expect(res.status).toBe(404);
  });

  it("PATCH on another user's transaction returns 404 (no leak)", async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    const bankB = await makeBank(oid(userB).toString());
    const cardB = await makeCard(oid(userB).toString(), oid(bankB).toString());
    const txnB = await makeTransaction(oid(userB).toString(), oid(cardB).toString());

    const agent = authedAgent(app, oid(userA).toString());
    const res = await agent
      .patch(`/transactions/${oid(txnB)}/fixed-expense`)
      .send({ fixedExpenseId: null });

    expect(res.status).toBe(404);
  });

  it('PATCH with a malformed ObjectId in :id returns 400', async () => {
    const user = await makeUser();
    const agent = authedAgent(app, oid(user).toString());

    const res = await agent
      .patch('/transactions/not-a-valid-id/fixed-expense')
      .send({ fixedExpenseId: null });

    expect(res.status).toBe(400);
  });
});

describe('Transactions routes — happy path & isolation', () => {
  it("POST /transactions/bulk then GET /transactions returns only this user's rows", async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    const bankA = await makeBank(oid(userA).toString());
    const cardA = await makeCard(oid(userA).toString(), oid(bankA).toString());

    const bankB = await makeBank(oid(userB).toString());
    const cardB = await makeCard(oid(userB).toString(), oid(bankB).toString());
    await makeTransaction(oid(userB).toString(), oid(cardB).toString(), { description: 'B-only' });

    const agentA = authedAgent(app, oid(userA).toString());
    const postRes = await agentA.post('/transactions/bulk').send({
      transactions: [
        { amount: 10, description: 'A1', date: '2026-05-10' },
        { amount: 20, description: 'A2', date: '2026-05-11' },
      ],
      cardId: oid(cardA).toString(),
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
    const bank = await makeBank(oid(user).toString());
    const card = await makeCard(oid(user).toString(), oid(bank).toString());
    const agent = authedAgent(app, oid(user).toString());

    const body = {
      transactions: [{ amount: 10, description: 'dup', date: '2026-05-10' }],
      cardId: oid(card).toString(),
      fileName: 'dup.csv',
      fileHash: 'same-hash',
    };

    const first = await agent.post('/transactions/bulk').send(body);
    const second = await agent.post('/transactions/bulk').send(body);

    expect([200, 201, 204]).toContain(first.status);
    expect([200, 201, 204, 409, 500]).toContain(second.status);
  });
});
