import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeBudgetCategory,
  makeBudgetCategoryOverride,
  makeTransaction,
  makeUser,
} from '../../../test/helpers/factories';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  budgetCategories,
  budgets,
  budgetOverrides,
  transactionCategories,
} from '../../db/schema';
import { createHousehold, joinByCode } from '../households/household.service';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { getBudgetSummary } from './budgetSummary.service';

afterEach(truncateAll);
afterAll(closeTestDb);

const MAY = new Date('2026-05-10');

/** A scope for one member who has been present since the beginning of time. */
const soloScope = (householdId: string, userId: string): BudgetScope => ({
  householdId,
  members: [{ userId, from: new Date('2000-01-01'), to: null }],
});

const tag = async (
  transactionId: string,
  categoryId: string,
  householdId: string,
  userId: string
) => {
  await db.insert(transactionCategories).values({
    transactionId,
    categoryId,
    householdId,
    createdBy: userId,
  });
};

describe('getBudgetSummary — household scope', () => {
  it('returns the base salary as income when no override exists', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await db.insert(budgets).values({ salary: 5000, createdBy: user.id });

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.income).toBe(5000);
    expect(result.usingActualIncome).toBe(false);
  });

  it('prefers the salary override and flags it', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await db.insert(budgets).values({ salary: 5000, createdBy: user.id });
    await db
      .insert(budgetOverrides)
      .values({ month: 5, year: 2026, salary: 4700, createdBy: user.id });

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.income).toBe(4700);
    expect(result.usingActualIncome).toBe(true);
  });

  it('costs a fixed category its planned amount before the charge lands', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeBudgetCategory(user.id, {
      name: 'Rent',
      kind: 'fixed',
      plannedAmount: 1800,
      householdId: household.id,
    });

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.categories[0]).toMatchObject({
      name: 'Rent',
      planned: 1800,
      actual: 0,
      cost: 1800,
      transactionCount: 0,
    });
  });

  it('costs a fixed category the actual amount once it exceeds the plan', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const cat = await makeBudgetCategory(user.id, {
      name: 'Rent',
      kind: 'fixed',
      plannedAmount: 1800,
      householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 1850, date: MAY });
    await tag(txn.id, cat.id, household.id, user.id);

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.categories[0]).toMatchObject({
      planned: 1800,
      actual: 1850,
      cost: 1850,
    });
  });

  it('costs a flexible category exactly what was spent, over or under', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const under = await makeBudgetCategory(user.id, {
      name: 'Groceries',
      kind: 'flexible',
      plannedAmount: 600,
      householdId: household.id,
    });
    const over = await makeBudgetCategory(user.id, {
      name: 'Dining',
      kind: 'flexible',
      plannedAmount: 200,
      householdId: household.id,
    });
    const t1 = await makeTransaction(user.id, { amount: 540, date: MAY });
    await tag(t1.id, under.id, household.id, user.id);
    const t2 = await makeTransaction(user.id, { amount: 310, date: MAY });
    await tag(t2.id, over.id, household.id, user.id);

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);
    const byName = Object.fromEntries(result.categories.map(c => [c.name, c]));

    expect(byName.Groceries).toMatchObject({ planned: 600, actual: 540, cost: 540 });
    expect(byName.Dining).toMatchObject({ planned: 200, actual: 310, cost: 310 });
  });

  it('excludes an ignored category from cost entirely', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await db.insert(budgets).values({ salary: 5000, createdBy: user.id });
    const cat = await makeBudgetCategory(user.id, {
      name: 'Card payments',
      kind: 'ignored',
      plannedAmount: 0,
      householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 1240, date: MAY });
    await tag(txn.id, cat.id, household.id, user.id);

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.categories[0]).toMatchObject({ actual: 1240, cost: 0, planned: 0 });
    expect(result.totalCost).toBe(0);
    expect(result.moneyLeft).toBe(5000);
  });

  it('prefers a per-month override over the base planned amount', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const cat = await makeBudgetCategory(user.id, {
      name: 'Gifts',
      kind: 'flexible',
      plannedAmount: 100,
      householdId: household.id,
    });
    await makeBudgetCategoryOverride(user.id, cat.id, {
      month: 5,
      year: 2026,
      plannedAmount: 900,
    });

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.categories[0]).toMatchObject({ planned: 900, isOverridden: true });
  });

  it('ignores an override for a different month', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const cat = await makeBudgetCategory(user.id, {
      name: 'Gifts',
      kind: 'flexible',
      plannedAmount: 100,
      householdId: household.id,
    });
    await makeBudgetCategoryOverride(user.id, cat.id, {
      month: 12,
      year: 2026,
      plannedAmount: 900,
    });

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.categories[0]).toMatchObject({ planned: 100, isOverridden: false });
  });

  it('counts untagged debits against money left', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await db.insert(budgets).values({ salary: 5000, createdBy: user.id });
    await makeTransaction(user.id, { amount: 120, date: MAY });

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.untagged.amount).toBe(120);
    expect(result.untagged.transactionCount).toBe(1);
    expect(result.untagged.byMember).toEqual([
      expect.objectContaining({ userId: user.id, actual: 120, transactionCount: 1 }),
    ]);
    expect(result.moneyLeft).toBe(4880);
  });

  it('excludes credits from every total', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await db.insert(budgets).values({ salary: 5000, createdBy: user.id });
    await makeTransaction(user.id, { amount: -2000, date: MAY });

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.untagged).toEqual({ amount: 0, transactionCount: 0, byMember: [] });
    expect(result.moneyLeft).toBe(5000);
  });

  it('excludes transactions from other months', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const cat = await makeBudgetCategory(user.id, {
      kind: 'flexible',
      plannedAmount: 600,
      householdId: household.id,
    });
    const txn = await makeTransaction(user.id, {
      amount: 999,
      date: new Date('2026-06-10'),
    });
    await tag(txn.id, cat.id, household.id, user.id);

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(result.categories[0].actual).toBe(0);
  });

  it('computes the totals from the spec example', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await db.insert(budgets).values({ salary: 5000, createdBy: user.id });
    const rent = await makeBudgetCategory(user.id, {
      name: 'Rent',
      kind: 'fixed',
      plannedAmount: 1800,
      householdId: household.id,
    });
    const phone = await makeBudgetCategory(user.id, {
      name: 'Phone',
      kind: 'fixed',
      plannedAmount: 60,
      householdId: household.id,
    });
    const groceries = await makeBudgetCategory(user.id, {
      name: 'Groceries',
      kind: 'flexible',
      plannedAmount: 600,
      householdId: household.id,
    });
    const dining = await makeBudgetCategory(user.id, {
      name: 'Dining',
      kind: 'flexible',
      plannedAmount: 200,
      householdId: household.id,
    });

    const t1 = await makeTransaction(user.id, { amount: 1800, date: MAY });
    await tag(t1.id, rent.id, household.id, user.id);
    const t2 = await makeTransaction(user.id, { amount: 55, date: MAY });
    await tag(t2.id, phone.id, household.id, user.id);
    const t3 = await makeTransaction(user.id, { amount: 540, date: MAY });
    await tag(t3.id, groceries.id, household.id, user.id);
    const t4 = await makeTransaction(user.id, { amount: 310, date: MAY });
    await tag(t4.id, dining.id, household.id, user.id);
    await makeTransaction(user.id, { amount: 120, date: MAY });

    const result = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    // planned: 1800 + 60 + 600 + 200
    expect(result.totalPlanned).toBe(2660);
    // cost: max(1800,1800)=1800, max(60,55)=60, 540, 310, plus untagged 120
    expect(result.totalCost).toBe(2830);
    expect(result.moneyLeft).toBe(2170);
  });

  it('sums income across members, applying each override', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await createHousehold('Home', a.id);
    await createHousehold('Other', b.id);
    await joinByCode(household.inviteCode, b.id);

    await db.insert(budgets).values([
      { createdBy: a.id, salary: 5000 },
      { createdBy: b.id, salary: 3000 },
    ]);
    await db
      .insert(budgetOverrides)
      .values({ createdBy: b.id, month: 5, year: 2026, salary: 3500 });

    const scope: BudgetScope = {
      householdId: household.id,
      members: [
        { userId: a.id, from: new Date('2000-01-01'), to: null },
        { userId: b.id, from: new Date('2000-01-01'), to: null },
      ],
    };

    const summary = await getBudgetSummary(scope, 5, 2026);

    expect(summary.income).toBe(8500);
    expect(summary.usingActualIncome).toBe(true);
  });

  it('counts a member with no budget row as zero income', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await createHousehold('Home', a.id);
    await db.insert(budgets).values({ createdBy: a.id, salary: 5000 });

    const scope: BudgetScope = {
      householdId: household.id,
      members: [
        { userId: a.id, from: new Date('2000-01-01'), to: null },
        { userId: b.id, from: new Date('2000-01-01'), to: null },
      ],
    };

    expect((await getBudgetSummary(scope, 5, 2026)).income).toBe(5000);
  });

  it('attributes a category charged by one member via byMember', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await createHousehold('Home', a.id);
    const category = await makeBudgetCategory(a.id, {
      kind: 'flexible',
      plannedAmount: 500,
      householdId: household.id,
    });
    const txn = await makeTransaction(b.id, {
      amount: 120,
      date: new Date(2026, 4, 10),
    });
    await tag(txn.id, category.id, household.id, b.id);

    const scope: BudgetScope = {
      householdId: household.id,
      members: [
        { userId: a.id, from: new Date('2000-01-01'), to: null },
        { userId: b.id, from: new Date('2000-01-01'), to: null },
      ],
    };

    const summary = await getBudgetSummary(scope, 5, 2026);
    const row = summary.categories.find(c => c.categoryId === category.id)!;

    expect(row.actual).toBe(120);
    expect(row.byMember).toEqual([
      expect.objectContaining({
        userId: b.id,
        email: b.email,
        actual: 120,
        transactionCount: 1,
      }),
    ]);
  });

  it("excludes a member's transactions from months before they joined", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await createHousehold('Home', a.id);
    await makeTransaction(b.id, { amount: 80, date: new Date(2026, 3, 10) });

    const scope: BudgetScope = {
      householdId: household.id,
      members: [
        { userId: a.id, from: new Date('2000-01-01'), to: null },
        { userId: b.id, from: new Date(2026, 4, 1), to: null },
      ],
    };

    const april = await getBudgetSummary(scope, 4, 2026);
    expect(april.untagged.amount).toBe(0);
  });

  it("includes a departed member's transactions from inside their tenure", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await createHousehold('Home', a.id);
    await makeTransaction(b.id, { amount: 60, date: new Date(2026, 4, 10) });

    const scope: BudgetScope = {
      householdId: household.id,
      members: [
        { userId: a.id, from: new Date('2000-01-01'), to: null },
        { userId: b.id, from: new Date(2026, 0, 1), to: new Date(2026, 6, 1) },
      ],
    };

    const summary = await getBudgetSummary(scope, 5, 2026);
    expect(summary.untagged.amount).toBe(60);
    expect(summary.untagged.byMember).toEqual([
      expect.objectContaining({ userId: b.id, actual: 60 }),
    ]);
  });

  it('ignores tags belonging to another household', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const mine = await createHousehold('Mine', a.id);
    const theirs = await createHousehold('Theirs', b.id);
    const theirCategory = await makeBudgetCategory(b.id, {
      kind: 'flexible',
      plannedAmount: 100,
      householdId: theirs.id,
    });
    const txn = await makeTransaction(a.id, {
      amount: 40,
      date: new Date(2026, 4, 10),
    });
    await tag(txn.id, theirCategory.id, theirs.id, b.id);

    const summary = await getBudgetSummary(soloScope(mine.id, a.id), 5, 2026);

    // My household never tagged it, so to me it is untagged spending.
    expect(summary.untagged.amount).toBe(40);
    expect(summary.categories).toHaveLength(0);
  });

  it('costs an uncharged fixed category at its planned amount', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeBudgetCategory(user.id, {
      kind: 'fixed',
      plannedAmount: 2000,
      householdId: household.id,
    });

    const summary = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(summary.categories[0].cost).toBe(2000);
    expect(summary.categories[0].actual).toBe(0);
    expect(summary.totalCost).toBe(2000);
  });

  it('still reports a soft-deleted category that was tagged in the month', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const category = await makeBudgetCategory(user.id, {
      name: 'Dining',
      kind: 'flexible',
      plannedAmount: 200,
      householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 75, date: MAY });
    await tag(txn.id, category.id, household.id, user.id);

    const before = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    await db
      .update(budgetCategories)
      .set({ deletedAt: new Date() })
      .where(eq(budgetCategories.id, category.id));

    const after = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);
    const row = after.categories.find(c => c.categoryId === category.id);

    expect(row).toBeDefined();
    expect(row!.actual).toBe(75);
    expect(row!.byMember).toEqual([
      expect.objectContaining({ userId: user.id, actual: 75, transactionCount: 1 }),
    ]);
    expect(after.totalCost).toBe(before.totalCost);
  });

  it('omits a soft-deleted category with no tagged transaction in the month', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const category = await makeBudgetCategory(user.id, {
      name: 'Subscriptions',
      kind: 'flexible',
      plannedAmount: 50,
      householdId: household.id,
    });
    await db
      .update(budgetCategories)
      .set({ deletedAt: new Date() })
      .where(eq(budgetCategories.id, category.id));

    const summary = await getBudgetSummary(soloScope(household.id, user.id), 5, 2026);

    expect(summary.categories.find(c => c.categoryId === category.id)).toBeUndefined();
  });
});

describe('getBudgetSummary — narrowed to one member', () => {
  /** A two-member household, both present since the beginning of time. */
  const pairScope = (
    householdId: string,
    aId: string,
    bId: string
  ): BudgetScope => ({
    householdId,
    members: [
      { userId: aId, from: new Date('2000-01-01'), to: null },
      { userId: bId, from: new Date('2000-01-01'), to: null },
    ],
  });

  const makePair = async () => {
    const a = await makeUser();
    const household = await createHousehold('Home', a.id);
    const b = await makeUser();
    await joinByCode(household.inviteCode, b.id);
    return { a, b, household, scope: pairScope(household.id, a.id, b.id) };
  };

  it('counts only the named member’s salary as income', async () => {
    const { a, b, scope } = await makePair();
    await db.insert(budgets).values({ salary: 5000, createdBy: a.id });
    await db.insert(budgets).values({ salary: 3000, createdBy: b.id });

    const household = await getBudgetSummary(scope, 5, 2026);
    const mine = await getBudgetSummary(scope, 5, 2026, a.id);

    expect(household.income).toBe(8000);
    expect(mine.income).toBe(5000);
  });

  it('uses only the named member’s salary override', async () => {
    const { a, b, scope } = await makePair();
    await db.insert(budgets).values({ salary: 5000, createdBy: a.id });
    await db.insert(budgets).values({ salary: 3000, createdBy: b.id });
    await db
      .insert(budgetOverrides)
      .values({ salary: 4200, month: 5, year: 2026, createdBy: b.id });

    const mine = await getBudgetSummary(scope, 5, 2026, a.id);
    const theirs = await getBudgetSummary(scope, 5, 2026, b.id);

    expect(mine).toMatchObject({ income: 5000, usingActualIncome: false });
    expect(theirs).toMatchObject({ income: 4200, usingActualIncome: true });
  });

  it('counts only the named member’s tagged spending', async () => {
    const { a, b, household, scope } = await makePair();
    const cat = await makeBudgetCategory(a.id, {
      name: 'Groceries',
      kind: 'flexible',
      plannedAmount: 600,
      householdId: household.id,
    });
    const mineTxn = await makeTransaction(a.id, { amount: 100, date: MAY });
    await tag(mineTxn.id, cat.id, household.id, a.id);
    const theirTxn = await makeTransaction(b.id, { amount: 40, date: MAY });
    await tag(theirTxn.id, cat.id, household.id, b.id);

    const bothResult = await getBudgetSummary(scope, 5, 2026);
    const mineResult = await getBudgetSummary(scope, 5, 2026, a.id);

    expect(bothResult.categories[0]).toMatchObject({
      actual: 140,
      transactionCount: 2,
    });
    expect(mineResult.categories[0]).toMatchObject({
      actual: 100,
      transactionCount: 1,
    });
    expect(mineResult.categories[0].byMember).toHaveLength(1);
  });

  it('counts only the named member’s untagged spending', async () => {
    const { a, b, scope } = await makePair();
    await makeTransaction(a.id, { amount: 100, date: MAY });
    await makeTransaction(b.id, { amount: 40, date: MAY });

    const bothResult = await getBudgetSummary(scope, 5, 2026);
    const mineResult = await getBudgetSummary(scope, 5, 2026, a.id);

    expect(bothResult.untagged).toMatchObject({ amount: 140, transactionCount: 2 });
    expect(mineResult.untagged).toMatchObject({ amount: 100, transactionCount: 1 });
  });

  it('still ignores credits when narrowed to one member', async () => {
    const { a, scope } = await makePair();
    await db.insert(budgets).values({ salary: 5000, createdBy: a.id });
    await makeTransaction(a.id, { amount: 100, date: MAY });
    await makeTransaction(a.id, { amount: -60, date: MAY });

    const mine = await getBudgetSummary(scope, 5, 2026, a.id);

    expect(mine.untagged.amount).toBe(100);
    expect(mine.totalCost).toBe(100);
    expect(mine.moneyLeft).toBe(4900);
  });
});
