import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeBudgetCategory, makeTransaction } from '../../../test/helpers/factories';
import { setTransactionCategory } from './transaction.service';

let userId: string;

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
});

describe('setTransactionCategory', () => {
  it('404s when the transaction is not the caller transaction', async () => {
    const other = await makeUser();
    const txn = await makeTransaction(other.id);

    await expect(
      setTransactionCategory(userId, txn.id, { categoryId: null })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('untags when categoryId is null', async () => {
    const cat = await makeBudgetCategory(userId);
    const txn = await makeTransaction(userId, { categoryId: cat.id });

    const result = await setTransactionCategory(userId, txn.id, { categoryId: null });

    expect(result.categoryId).toBeUndefined();
  });

  it('rejects tagging a credit (non-debit) transaction', async () => {
    const cat = await makeBudgetCategory(userId);
    const txn = await makeTransaction(userId, { amount: -10 });

    await expect(
      setTransactionCategory(userId, txn.id, { categoryId: cat.id })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('400s when the category belongs to another user', async () => {
    const other = await makeUser();
    const cat = await makeBudgetCategory(other.id);
    const txn = await makeTransaction(userId);

    await expect(
      setTransactionCategory(userId, txn.id, { categoryId: cat.id })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('409s on a second transaction in the same month for a fixed category', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 1800 });
    await makeTransaction(userId, { date: new Date('2026-05-03'), categoryId: cat.id });
    const second = await makeTransaction(userId, { date: new Date('2026-05-20') });

    await expect(
      setTransactionCategory(userId, second.id, { categoryId: cat.id })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows a fixed category to be used again in a different month', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 1800 });
    await makeTransaction(userId, { date: new Date('2026-05-03'), categoryId: cat.id });
    const june = await makeTransaction(userId, { date: new Date('2026-06-03') });

    const result = await setTransactionCategory(userId, june.id, { categoryId: cat.id });

    expect(result.categoryId).toBe(cat.id);
  });

  it('allows many transactions in one month for a flexible category', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible', plannedAmount: 600 });
    const a = await makeTransaction(userId, { date: new Date('2026-05-03') });
    const b = await makeTransaction(userId, { date: new Date('2026-05-04') });

    await setTransactionCategory(userId, a.id, { categoryId: cat.id });
    const result = await setTransactionCategory(userId, b.id, { categoryId: cat.id });

    expect(result.categoryId).toBe(cat.id);
  });

  it('allows many transactions in one month for an ignored category', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'ignored', plannedAmount: 0 });
    const a = await makeTransaction(userId, { date: new Date('2026-05-03') });
    const b = await makeTransaction(userId, { date: new Date('2026-05-04') });

    await setTransactionCategory(userId, a.id, { categoryId: cat.id });
    const result = await setTransactionCategory(userId, b.id, { categoryId: cat.id });

    expect(result.categoryId).toBe(cat.id);
  });
});
