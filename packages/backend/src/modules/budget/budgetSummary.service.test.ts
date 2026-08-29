import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBudgetCategory,
  makeBudgetCategoryOverride,
  makeTransaction,
} from '../../../test/helpers/factories';
import { db } from '../../db/client';
import { budgets, budgetOverrides } from '../../db/schema';
import { getBudgetSummary } from './budgetSummary.service';

let userId: string;
const MAY = new Date('2026-05-10');

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
  await db.insert(budgets).values({ salary: 5000, createdBy: userId });
});

describe('getBudgetSummary', () => {
  it('returns the base salary as income when no override exists', async () => {
    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.income).toBe(5000);
    expect(result.usingActualIncome).toBe(false);
  });

  it('prefers the salary override and flags it', async () => {
    await db
      .insert(budgetOverrides)
      .values({ month: 5, year: 2026, salary: 4700, createdBy: userId });

    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.income).toBe(4700);
    expect(result.usingActualIncome).toBe(true);
  });

  it('costs a fixed category its planned amount before the charge lands', async () => {
    await makeBudgetCategory(userId, { name: 'Rent', kind: 'fixed', plannedAmount: 1800 });

    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.categories[0]).toMatchObject({
      name: 'Rent', planned: 1800, actual: 0, cost: 1800, transactionCount: 0,
    });
  });

  it('costs a fixed category the actual amount once it exceeds the plan', async () => {
    const cat = await makeBudgetCategory(userId, { name: 'Rent', kind: 'fixed', plannedAmount: 1800 });
    await makeTransaction(userId, { amount: 1850, date: MAY, categoryId: cat.id });

    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.categories[0]).toMatchObject({ planned: 1800, actual: 1850, cost: 1850 });
  });

  it('costs a flexible category exactly what was spent, over or under', async () => {
    const under = await makeBudgetCategory(userId, { name: 'Groceries', kind: 'flexible', plannedAmount: 600 });
    const over = await makeBudgetCategory(userId, { name: 'Dining', kind: 'flexible', plannedAmount: 200 });
    await makeTransaction(userId, { amount: 540, date: MAY, categoryId: under.id });
    await makeTransaction(userId, { amount: 310, date: MAY, categoryId: over.id });

    const result = await getBudgetSummary(userId, 5, 2026);
    const byName = Object.fromEntries(result.categories.map(c => [c.name, c]));

    expect(byName.Groceries).toMatchObject({ planned: 600, actual: 540, cost: 540 });
    expect(byName.Dining).toMatchObject({ planned: 200, actual: 310, cost: 310 });
  });

  it('excludes an ignored category from cost entirely', async () => {
    const cat = await makeBudgetCategory(userId, { name: 'Card payments', kind: 'ignored', plannedAmount: 0 });
    await makeTransaction(userId, { amount: 1240, date: MAY, categoryId: cat.id });

    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.categories[0]).toMatchObject({ actual: 1240, cost: 0, planned: 0 });
    expect(result.totalCost).toBe(0);
    expect(result.moneyLeft).toBe(5000);
  });

  it('prefers a per-month override over the base planned amount', async () => {
    const cat = await makeBudgetCategory(userId, { name: 'Gifts', kind: 'flexible', plannedAmount: 100 });
    await makeBudgetCategoryOverride(userId, cat.id, { month: 5, year: 2026, plannedAmount: 900 });

    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.categories[0]).toMatchObject({ planned: 900, isOverridden: true });
  });

  it('ignores an override for a different month', async () => {
    const cat = await makeBudgetCategory(userId, { name: 'Gifts', kind: 'flexible', plannedAmount: 100 });
    await makeBudgetCategoryOverride(userId, cat.id, { month: 12, year: 2026, plannedAmount: 900 });

    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.categories[0]).toMatchObject({ planned: 100, isOverridden: false });
  });

  it('counts untagged debits against money left', async () => {
    await makeTransaction(userId, { amount: 120, date: MAY });

    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.untagged).toEqual({ amount: 120, transactionCount: 1 });
    expect(result.moneyLeft).toBe(4880);
  });

  it('excludes credits from every total', async () => {
    await makeTransaction(userId, { amount: -2000, date: MAY });

    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.untagged).toEqual({ amount: 0, transactionCount: 0 });
    expect(result.moneyLeft).toBe(5000);
  });

  it('excludes transactions from other months', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible', plannedAmount: 600 });
    await makeTransaction(userId, { amount: 999, date: new Date('2026-06-10'), categoryId: cat.id });

    const result = await getBudgetSummary(userId, 5, 2026);

    expect(result.categories[0].actual).toBe(0);
  });

  it('computes the totals from the spec example', async () => {
    const rent = await makeBudgetCategory(userId, { name: 'Rent', kind: 'fixed', plannedAmount: 1800 });
    const phone = await makeBudgetCategory(userId, { name: 'Phone', kind: 'fixed', plannedAmount: 60 });
    const groceries = await makeBudgetCategory(userId, { name: 'Groceries', kind: 'flexible', plannedAmount: 600 });
    const dining = await makeBudgetCategory(userId, { name: 'Dining', kind: 'flexible', plannedAmount: 200 });

    await makeTransaction(userId, { amount: 1800, date: MAY, categoryId: rent.id });
    await makeTransaction(userId, { amount: 55, date: MAY, categoryId: phone.id });
    await makeTransaction(userId, { amount: 540, date: MAY, categoryId: groceries.id });
    await makeTransaction(userId, { amount: 310, date: MAY, categoryId: dining.id });
    await makeTransaction(userId, { amount: 120, date: MAY });

    const result = await getBudgetSummary(userId, 5, 2026);

    // planned: 1800 + 60 + 600 + 200
    expect(result.totalPlanned).toBe(2660);
    // cost: max(1800,1800)=1800, max(60,55)=60, 540, 310, plus untagged 120
    expect(result.totalCost).toBe(2830);
    expect(result.moneyLeft).toBe(2170);
  });
});
