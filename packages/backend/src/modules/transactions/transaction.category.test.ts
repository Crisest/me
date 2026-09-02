import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBudgetCategory,
  makeTransaction,
  makeHouseholdMember,
} from '../../../test/helpers/factories';
import { createHousehold } from '../../modules/households/household.service';
import { setTransactionCategory } from './transaction.service';
import { db } from '../../db/client';
import { budgetCategories, transactionCategories } from '../../db/schema';
import { and, eq, isNull } from 'drizzle-orm';

const addMember = (householdId: string, userId: string) =>
  makeHouseholdMember(householdId, userId);

let userId: string;
let householdId: string;
let scope: {
  householdId: string;
  members: { userId: string; from: Date; to: Date | null }[];
};

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

const liveCategoryId = async (transactionId: string): Promise<string | undefined> => {
  const [row] = await db
    .select()
    .from(transactionCategories)
    .where(
      and(
        eq(transactionCategories.transactionId, transactionId),
        isNull(transactionCategories.deletedAt)
      )
    );
  return row?.categoryId;
};

describe('setTransactionCategory', () => {
  it("tags another household member's transaction", async () => {
    const partner = await makeUser();
    await addMember(householdId, partner.id);
    const txn = await makeTransaction(partner.id, {
      amount: 25,
      date: new Date('2026-03-10'),
    });
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });

    scope.members.push({ userId: partner.id, from: new Date('2000-01-01'), to: null });

    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });

    expect(await liveCategoryId(txn.id)).toBe(cat.id);
  });

  it('records the acting user, not the transaction owner, as created_by', async () => {
    const partner = await makeUser();
    await addMember(householdId, partner.id);
    const txn = await makeTransaction(partner.id, {
      amount: 25,
      date: new Date('2026-03-10'),
    });
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });

    scope.members.push({ userId: partner.id, from: new Date('2000-01-01'), to: null });

    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });

    const [row] = await db
      .select()
      .from(transactionCategories)
      .where(
        and(
          eq(transactionCategories.transactionId, txn.id),
          isNull(transactionCategories.deletedAt)
        )
      );
    expect(row.createdBy).toBe(userId);
  });

  it('404s for a transaction dated outside every tenure window', async () => {
    const partner = await makeUser();
    await addMember(householdId, partner.id);
    const txn = await makeTransaction(partner.id, {
      amount: 25,
      date: new Date('2026-09-10'),
    });
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });

    scope.members.push({
      userId: partner.id,
      from: new Date('2000-01-01'),
      to: new Date('2026-04-01'),
    });

    await expect(
      setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s for a non-member's transaction", async () => {
    const outsider = await makeUser();
    const txn = await makeTransaction(outsider.id, {
      amount: 25,
      date: new Date('2026-03-10'),
    });
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });

    await expect(
      setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('untags when categoryId is null', async () => {
    const cat = await makeBudgetCategory(userId, { householdId });
    const txn = await makeTransaction(userId);

    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });
    const result = await setTransactionCategory(scope, userId, txn.id, { categoryId: null });

    expect(result.categoryId).toBeUndefined();
    expect(await liveCategoryId(txn.id)).toBeUndefined();
  });

  it('rejects tagging a credit (non-debit) transaction', async () => {
    const cat = await makeBudgetCategory(userId, { householdId });
    const txn = await makeTransaction(userId, { amount: -10 });

    await expect(
      setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('400s when the category belongs to another household', async () => {
    const other = await makeUser();
    const otherHousehold = await createHousehold('Theirs', other.id);
    const cat = await makeBudgetCategory(other.id, { householdId: otherHousehold.id });
    const txn = await makeTransaction(userId);

    await expect(
      setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('409s on a second transaction in the same month for a fixed category', async () => {
    const cat = await makeBudgetCategory(userId, {
      kind: 'fixed', plannedAmount: 1800, householdId,
    });
    const first = await makeTransaction(userId, { date: new Date('2026-05-03') });
    await setTransactionCategory(scope, userId, first.id, { categoryId: cat.id });
    const second = await makeTransaction(userId, { date: new Date('2026-05-20') });

    await expect(
      setTransactionCategory(scope, userId, second.id, { categoryId: cat.id })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows a fixed category to be used again in a different month', async () => {
    const cat = await makeBudgetCategory(userId, {
      kind: 'fixed', plannedAmount: 1800, householdId,
    });
    const may = await makeTransaction(userId, { date: new Date('2026-05-03') });
    await setTransactionCategory(scope, userId, may.id, { categoryId: cat.id });
    const june = await makeTransaction(userId, { date: new Date('2026-06-03') });

    const result = await setTransactionCategory(scope, userId, june.id, { categoryId: cat.id });

    expect(result.categoryId).toBe(cat.id);
  });

  it('allows many transactions in one month for a flexible category', async () => {
    const cat = await makeBudgetCategory(userId, {
      kind: 'flexible', plannedAmount: 600, householdId,
    });
    const a = await makeTransaction(userId, { date: new Date('2026-05-03') });
    const b = await makeTransaction(userId, { date: new Date('2026-05-04') });

    await setTransactionCategory(scope, userId, a.id, { categoryId: cat.id });
    const result = await setTransactionCategory(scope, userId, b.id, { categoryId: cat.id });

    expect(result.categoryId).toBe(cat.id);
  });

  it('allows many transactions in one month for an ignored category', async () => {
    const cat = await makeBudgetCategory(userId, {
      kind: 'ignored', plannedAmount: 0, householdId,
    });
    const a = await makeTransaction(userId, { date: new Date('2026-05-03') });
    const b = await makeTransaction(userId, { date: new Date('2026-05-04') });

    await setTransactionCategory(scope, userId, a.id, { categoryId: cat.id });
    const result = await setTransactionCategory(scope, userId, b.id, { categoryId: cat.id });

    expect(result.categoryId).toBe(cat.id);
  });

  it('400s when the category has been soft-deleted, but leaves a pre-existing tag row live', async () => {
    const cat = await makeBudgetCategory(userId, { householdId });
    const taggedBeforeDelete = await makeTransaction(userId);
    await setTransactionCategory(scope, userId, taggedBeforeDelete.id, { categoryId: cat.id });

    await db
      .update(budgetCategories)
      .set({ deletedAt: new Date() })
      .where(eq(budgetCategories.id, cat.id));

    const newTxn = await makeTransaction(userId);
    await expect(
      setTransactionCategory(scope, userId, newTxn.id, { categoryId: cat.id })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await liveCategoryId(taggedBeforeDelete.id)).toBe(cat.id);
  });
});
