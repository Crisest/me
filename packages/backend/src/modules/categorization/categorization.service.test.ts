import { db } from '../../db/client';
import { categorySuggestions } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBudgetCategory,
  makeTransaction,
  makeCategorySuggestion,
} from '../../../test/helpers/factories';
import { createHousehold } from '../../modules/households/household.service';
import { setTransactionCategory } from '../transactions/transaction.service';
import { createStubSuggester } from './stub.suggester';
import { generateSuggestions, getPendingSuggestions } from './categorization.service';

let userId: string;
let householdId: string;
let scope: { householdId: string; members: { userId: string; from: Date; to: Date | null }[] };

const MARCH = { month: 3, year: 2026 };
const inMarch = new Date('2026-03-10T12:00:00Z');

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
  const household = await createHousehold('Home', userId);
  householdId = household.id;
  scope = {
    householdId,
    members: [{ userId, from: new Date('2000-01-01'), to: null }],
  };
});

describe('generateSuggestions', () => {
  it('persists a pending row for a suggested candidate', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, { amount: 30, date: inMarch });
    const stub = createStubSuggester([
      { transactionId: txn.id, categoryId: cat.id, confidence: 0.7, reason: 'why' },
    ]);

    const result = await generateSuggestions(scope, userId, MARCH, stub);

    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe(cat.id);
    expect(result[0].source).toBe('stub');
    expect(result[0].transaction.id).toBe(txn.id);

    const rows = await db
      .select()
      .from(categorySuggestions)
      .where(eq(categorySuggestions.transactionId, txn.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].createdBy).toBe(userId);
  });

  it('excludes credits from the candidate set', async () => {
    await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    await makeTransaction(userId, { amount: -500, date: inMarch });
    const stub = createStubSuggester([]);

    await generateSuggestions(scope, userId, MARCH, stub);

    expect(stub.calls).toHaveLength(0);
  });

  it('excludes an already-tagged transaction', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, { amount: 30, date: inMarch });
    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });
    const stub = createStubSuggester([]);

    await generateSuggestions(scope, userId, MARCH, stub);

    expect(stub.calls).toHaveLength(0);
  });

  it('excludes a fixed category already claimed this month from the offered list', async () => {
    const fixed = await makeBudgetCategory(userId, { householdId, kind: 'fixed' });
    const flexible = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const claimed = await makeTransaction(userId, { amount: 1200, date: inMarch });
    await setTransactionCategory(scope, userId, claimed.id, { categoryId: fixed.id });
    // Distinct description: the default 'Test transaction' would collide with
    // `claimed`'s description and get resolved via history instead of
    // reaching the suggester, which is not what this test is verifying.
    await makeTransaction(userId, { amount: 30, description: 'Corner store', date: inMarch });
    const stub = createStubSuggester([]);

    await generateSuggestions(scope, userId, MARCH, stub);

    expect(stub.calls[0].categories.map(c => c.id)).toEqual([flexible.id]);
  });

  it("includes another household member's transactions", async () => {
    const partner = await makeUser();
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(partner.id, { amount: 30, date: inMarch });
    scope.members.push({ userId: partner.id, from: new Date('2000-01-01'), to: null });
    const stub = createStubSuggester([
      { transactionId: txn.id, categoryId: cat.id, confidence: 0.7, reason: 'why' },
    ]);

    const result = await generateSuggestions(scope, userId, MARCH, stub);

    expect(result[0].transaction.id).toBe(txn.id);
    expect(result[0].transaction.ownerEmail).toBe(partner.email);
  });

  it('resolves a repeat merchant from history without offering it to the suggester', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const past = await makeTransaction(userId, {
      amount: 20,
      description: 'LOBLAWS 1234',
      date: new Date('2026-02-10T12:00:00Z'),
    });
    await setTransactionCategory(scope, userId, past.id, { categoryId: cat.id });
    const repeat = await makeTransaction(userId, {
      amount: 25,
      description: 'LOBLAWS 9999',
      date: inMarch,
    });
    const stub = createStubSuggester([]);

    const result = await generateSuggestions(scope, userId, MARCH, stub);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('history');
    expect(result[0].confidence).toBe(1);
    expect(stub.calls).toHaveLength(0);
  });

  it('drops a suggestion naming an unknown category', async () => {
    await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, { amount: 30, date: inMarch });
    const stub = createStubSuggester([
      {
        transactionId: txn.id,
        categoryId: '00000000-0000-7000-8000-000000000000',
        confidence: 0.7,
        reason: 'bogus',
      },
    ]);

    expect(await generateSuggestions(scope, userId, MARCH, stub)).toEqual([]);
  });

  it('is a no-op on a second run and does not call the suggester again', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, { amount: 30, date: inMarch });
    const stub = createStubSuggester([
      { transactionId: txn.id, categoryId: cat.id, confidence: 0.7, reason: 'why' },
    ]);

    await generateSuggestions(scope, userId, MARCH, stub);
    const callsAfterFirst = stub.calls.length;
    const second = await generateSuggestions(scope, userId, MARCH, stub);

    expect(second).toEqual([]);
    expect(stub.calls).toHaveLength(callsAfterFirst);

    const rows = await db
      .select()
      .from(categorySuggestions)
      .where(eq(categorySuggestions.transactionId, txn.id));
    expect(rows).toHaveLength(1);
  });

  it('keeps a rejected transaction out of the candidate set', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, { amount: 30, date: inMarch });
    await makeCategorySuggestion(txn.id, cat.id, householdId, userId,
      { status: 'rejected', resolvedBy: userId, resolvedAt: new Date() }
    );
    const stub = createStubSuggester([]);

    await generateSuggestions(scope, userId, MARCH, stub);

    expect(stub.calls).toHaveLength(0);
  });

  it('runs history-only when no suggester is available', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const past = await makeTransaction(userId, {
      amount: 20,
      description: 'LOBLAWS 1',
      date: new Date('2026-02-10T12:00:00Z'),
    });
    await setTransactionCategory(scope, userId, past.id, { categoryId: cat.id });
    await makeTransaction(userId, { amount: 25, description: 'LOBLAWS 2', date: inMarch });
    await makeTransaction(userId, { amount: 40, description: 'UNKNOWN SHOP', date: inMarch });

    const result = await generateSuggestions(scope, userId, MARCH, undefined);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('history');
  });
});

describe('getPendingSuggestions', () => {
  it('returns only pending rows for the month', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const pending = await makeTransaction(userId, { amount: 30, date: inMarch });
    const resolved = await makeTransaction(userId, { amount: 40, date: inMarch });
    await makeCategorySuggestion(pending.id, cat.id, householdId, userId);
    await makeCategorySuggestion(resolved.id, cat.id, householdId, userId,
      { status: 'rejected' }
    );

    const result = await getPendingSuggestions(scope, MARCH);

    expect(result.map(s => s.transaction.id)).toEqual([pending.id]);
  });
});
