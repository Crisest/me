import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeBudgetCategory, makeTransaction } from '../../../test/helpers/factories';
import { getMonthlyInsights } from './transaction.insights.service';

let userId: string;
const MAY = new Date('2026-05-10');

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
});

describe('getMonthlyInsights', () => {
  it('counts a fixed-category debit in totalSpent', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 1800 });
    await makeTransaction(userId, { amount: 1800, date: MAY, categoryId: cat.id });

    const result = await getMonthlyInsights(userId, 5, 2026);

    expect(result.totalSpent).toBe(1800);
  });

  it('excludes an ignored-category debit from totalSpent', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'ignored', plannedAmount: 0 });
    await makeTransaction(userId, { amount: 1240, date: MAY, categoryId: cat.id });

    const result = await getMonthlyInsights(userId, 5, 2026);

    expect(result.totalSpent).toBe(0);
    expect(result.debitCount).toBe(0);
  });

  it('counts distinct fixed categories in matchedFixedCount', async () => {
    const rent = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 1800 });
    const phone = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 60 });
    const groceries = await makeBudgetCategory(userId, { kind: 'flexible', plannedAmount: 600 });
    await makeTransaction(userId, { amount: 1800, date: MAY, categoryId: rent.id });
    await makeTransaction(userId, { amount: 55, date: MAY, categoryId: phone.id });
    await makeTransaction(userId, { amount: 20, date: MAY, categoryId: groceries.id });

    const result = await getMonthlyInsights(userId, 5, 2026);

    expect(result.matchedFixedCount).toBe(2);
  });

  it('still reports credits as income', async () => {
    await makeTransaction(userId, { amount: -2000, date: MAY });

    const result = await getMonthlyInsights(userId, 5, 2026);

    expect(result.totalIncome).toBe(2000);
    expect(result.creditCount).toBe(1);
  });

  it('reports totalIncome as positive and netAmount as income minus spend', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 1800 });
    await makeTransaction(userId, { amount: 1800, date: MAY, categoryId: cat.id });
    await makeTransaction(userId, { amount: -2000, date: MAY });

    const result = await getMonthlyInsights(userId, 5, 2026);

    expect(result.totalIncome).toBe(2000);
    expect(result.averageCredit).toBe(2000);
    expect(result.netAmount).toBe(200);
  });
});
