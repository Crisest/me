import { db } from '../../db/client';
import { categorySuggestions, transactionCategories } from '../../db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBudgetCategory,
  makeTransaction,
  makeCategorySuggestion,
} from '../../../test/helpers/factories';
import { createHousehold } from '../../modules/households/household.service';
import { resolveSuggestions } from './categorization.resolve.service';

let userId: string;
let householdId: string;
let scope: { householdId: string; members: { userId: string; from: Date; to: Date | null }[] };

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

const liveTag = async (transactionId: string) => {
  const [row] = await db
    .select()
    .from(transactionCategories)
    .where(
      and(
        eq(transactionCategories.transactionId, transactionId),
        isNull(transactionCategories.deletedAt)
      )
    );
  return row;
};

const statusOf = async (id: string) => {
  const [row] = await db
    .select()
    .from(categorySuggestions)
    .where(eq(categorySuggestions.id, id));
  return row;
};

describe('resolveSuggestions', () => {
  it('accept writes the tag and marks the row accepted', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, { amount: 30, date: inMarch });
    const sug = await makeCategorySuggestion(txn.id, cat.id, householdId, userId);

    const results = await resolveSuggestions(scope, userId, [
      { id: sug.id, action: 'accept' },
    ]);

    expect(results).toEqual([{ id: sug.id, ok: true }]);
    expect((await liveTag(txn.id)).categoryId).toBe(cat.id);

    const row = await statusOf(sug.id);
    expect(row.status).toBe('accepted');
    expect(row.resolvedBy).toBe(userId);
    expect(row.resolvedAt).not.toBeNull();
  });

  it('accept with a categoryId override tags the override but keeps the proposal', async () => {
    const proposed = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const chosen = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, { amount: 30, date: inMarch });
    const sug = await makeCategorySuggestion(txn.id, proposed.id, householdId, userId);

    await resolveSuggestions(scope, userId, [
      { id: sug.id, action: 'accept', categoryId: chosen.id },
    ]);

    expect((await liveTag(txn.id)).categoryId).toBe(chosen.id);
    expect((await statusOf(sug.id)).categoryId).toBe(proposed.id);
  });

  it('reject marks the row and writes no tag', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, { amount: 30, date: inMarch });
    const sug = await makeCategorySuggestion(txn.id, cat.id, householdId, userId);

    await resolveSuggestions(scope, userId, [{ id: sug.id, action: 'reject' }]);

    expect(await liveTag(txn.id)).toBeUndefined();
    expect((await statusOf(sug.id)).status).toBe('rejected');
  });

  it('reports a failure per item without discarding the others', async () => {
    const fixed = await makeBudgetCategory(userId, { householdId, kind: 'fixed' });
    const flexible = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const first = await makeTransaction(userId, { amount: 1200, date: inMarch });
    const second = await makeTransaction(userId, { amount: 1200, date: inMarch });
    const third = await makeTransaction(userId, { amount: 40, date: inMarch });

    const sugA = await makeCategorySuggestion(first.id, fixed.id, householdId, userId);
    const sugB = await makeCategorySuggestion(second.id, fixed.id, householdId, userId);
    const sugC = await makeCategorySuggestion(third.id, flexible.id, householdId, userId);

    const results = await resolveSuggestions(scope, userId, [
      { id: sugA.id, action: 'accept' },
      { id: sugB.id, action: 'accept' },
      { id: sugC.id, action: 'accept' },
    ]);

    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect(results[1].error).toBeTruthy();
    expect(results[2].ok).toBe(true);
    expect((await statusOf(sugB.id)).status).toBe('pending');
  });

  it("fails an item for a suggestion in another household", async () => {
    const other = await makeUser();
    const otherHousehold = await createHousehold('Theirs', other.id);
    const cat = await makeBudgetCategory(other.id, { householdId: otherHousehold.id, kind: 'flexible' });
    const txn = await makeTransaction(other.id, { amount: 30, date: inMarch });
    const sug = await makeCategorySuggestion(txn.id, cat.id, otherHousehold.id, other.id);

    const results = await resolveSuggestions(scope, userId, [
      { id: sug.id, action: 'accept' },
    ]);

    expect(results[0].ok).toBe(false);
    expect((await statusOf(sug.id)).status).toBe('pending');
  });

  it('fails an item for an already-resolved suggestion', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, { amount: 30, date: inMarch });
    const sug = await makeCategorySuggestion(txn.id, cat.id, householdId, userId,
      { status: 'rejected' }
    );

    const results = await resolveSuggestions(scope, userId, [
      { id: sug.id, action: 'accept' },
    ]);

    expect(results[0].ok).toBe(false);
  });
});
