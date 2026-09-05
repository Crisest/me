import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBudgetCategory,
  makeTransaction,
  makeTransactionCategory,
} from '../../../test/helpers/factories';
import { createHousehold } from '../households/household.service';
import { aggregateSpend, getCategoryIdsByHousehold } from './insights.query';

afterEach(truncateAll);
afterAll(closeTestDb);

const JAN = new Date('2026-01-01T00:00:00Z');
const FEB = new Date('2026-02-01T00:00:00Z');
const inJan = (day: number) =>
  new Date(`2026-01-${String(day).padStart(2, '0')}T12:00:00Z`);

/** Whole-history window, for the cases that are not about tenure. */
const since = (...userIds: string[]) =>
  userIds.map(userId => ({ userId, from: new Date(0), to: null }));

describe('aggregateSpend', () => {
  it('returns zeroes for a user with no transactions', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const result = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });
    expect(result).toEqual({
      totalSpent: 0,
      fixedSpent: 0,
      debitCount: 0,
      averageDebit: 0,
      totalIncome: 0,
      creditCount: 0,
      averageCredit: 0,
      matchedFixedCount: 0,
    });
  });

  it('returns zeroes when there are no owner windows at all', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeTransaction(user.id, { amount: 100, date: inJan(5) });

    const result = await aggregateSpend({
      householdId: household.id,
      ownerWindows: [],
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });
    expect(result.totalSpent).toBe(0);
  });

  // THE REGRESSION TEST. A debit with no tag row is still spending; a bare
  // SQL NOT IN would drop it, under-reporting the month.
  it('counts UNTAGGED debits as spending even when categories are excluded', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const ignored = await makeBudgetCategory(user.id, {
      name: 'Transfers',
      kind: 'ignored',
      plannedAmount: 0,
      householdId: household.id,
    });

    await makeTransaction(user.id, { amount: 100, date: inJan(5) });
    const tagged = await makeTransaction(user.id, { amount: 999, date: inJan(6) });
    await makeTransactionCategory(tagged.id, ignored.id, household.id, user.id);

    const result = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [ignored.id],
      fixedCategoryIds: [],
    });

    expect(result.totalSpent).toBe(100);
    expect(result.debitCount).toBe(1);
  });

  it('handles an empty exclusion list without dropping rows', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeTransaction(user.id, { amount: 40, date: inJan(5) });

    const result = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });
    expect(result.totalSpent).toBe(40);
  });

  it('separates debits (positive) from credits (negative)', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeTransaction(user.id, { amount: 100, date: inJan(5) });
    await makeTransaction(user.id, { amount: 50, date: inJan(6) });
    await makeTransaction(user.id, { amount: -800, date: inJan(7) });

    const r = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });

    expect(r.totalSpent).toBe(150);
    expect(r.debitCount).toBe(2);
    expect(r.averageDebit).toBe(75);
    expect(r.totalIncome).toBe(-800);
    expect(r.creditCount).toBe(1);
    expect(r.averageCredit).toBe(-800);
  });

  it('matchedFixedCount counts DISTINCT categories, not rows', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const rent = await makeBudgetCategory(user.id, {
      name: 'Rent',
      kind: 'fixed',
      householdId: household.id,
    });
    const gym = await makeBudgetCategory(user.id, {
      name: 'Gym',
      kind: 'fixed',
      householdId: household.id,
    });

    for (const [day, category] of [
      [1, rent],
      [2, rent],
      [3, gym],
    ] as const) {
      const t = await makeTransaction(user.id, { amount: 40, date: inJan(day) });
      await makeTransactionCategory(t.id, category.id, household.id, user.id);
    }

    const r = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [rent.id, gym.id],
    });
    expect(r.matchedFixedCount).toBe(2);
  });

  it('respects the date window', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeTransaction(user.id, { amount: 10, date: inJan(31) });
    await makeTransaction(user.id, {
      amount: 999,
      date: new Date('2026-02-01T00:00:00Z'),
    });

    const r = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });
    expect(r.totalSpent).toBe(10);
  });

  it('aggregates across every member of the household', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await createHousehold('Home', a.id);
    await makeTransaction(a.id, { amount: 60, date: inJan(5) });
    await makeTransaction(b.id, { amount: 40, date: inJan(5) });

    const r = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(a.id, b.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });
    expect(r.totalSpent).toBe(100);
    expect(r.debitCount).toBe(2);
  });

  it('bounds a member to their tenure window', async () => {
    const stayed = await makeUser();
    const left = await makeUser();
    const household = await createHousehold('Home', stayed.id);

    await makeTransaction(left.id, { amount: 30, date: inJan(5) });
    // Dated after they left: must not count toward the household.
    await makeTransaction(left.id, { amount: 900, date: inJan(20) });
    await makeTransaction(stayed.id, { amount: 70, date: inJan(25) });

    const r = await aggregateSpend({
      householdId: household.id,
      ownerWindows: [
        { userId: stayed.id, from: new Date(0), to: null },
        { userId: left.id, from: new Date(0), to: inJan(10) },
      ],
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });

    expect(r.totalSpent).toBe(100);
    expect(r.debitCount).toBe(2);
  });

  it('returns numbers, not strings', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeTransaction(user.id, { amount: 12.34, date: inJan(5) });
    const r = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });
    // numeric and bigint arrive from node-postgres as strings without a cast.
    for (const v of Object.values(r)) {
      expect(typeof v).toBe('number');
    }
    expect(r.totalSpent).toBe(12.34);
  });

  it('getCategoryIdsByHousehold resolves a category authored by ANY household member', async () => {
    const owner = await makeUser();
    const partner = await makeUser();
    const household = await createHousehold('Home', owner.id);
    const other = await createHousehold('Other', partner.id);

    const ignoredByPartner = await makeBudgetCategory(partner.id, {
      kind: 'ignored',
      plannedAmount: 0,
      householdId: household.id,
    });
    await makeBudgetCategory(partner.id, {
      kind: 'ignored',
      plannedAmount: 0,
      householdId: other.id,
    });

    expect(await getCategoryIdsByHousehold(household.id, 'ignored')).toEqual([
      ignoredByPartner.id,
    ]);
  });
});

describe('aggregateSpend — tag row resolution', () => {
  it('excludes a debit tagged via a live transaction_categories row', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const ignored = await makeBudgetCategory(user.id, {
      kind: 'ignored',
      plannedAmount: 0,
      householdId: household.id,
    });
    const tagged = await makeTransaction(user.id, { amount: 500, date: inJan(5) });
    await makeTransaction(user.id, { amount: 100, date: inJan(6) });
    await makeTransactionCategory(tagged.id, ignored.id, household.id, user.id);

    const result = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [ignored.id],
      fixedCategoryIds: [],
    });

    expect(result.totalSpent).toBe(100);
  });

  it('ignores the dormant transactions.category_id column', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const ignored = await makeBudgetCategory(user.id, {
      kind: 'ignored',
      plannedAmount: 0,
      householdId: household.id,
    });
    // The legacy column set as a pre-cutover row would carry it, with no live
    // tag row. Nothing has written that column since the household cutover,
    // so it must not exclude the debit.
    await makeTransaction(user.id, {
      amount: 500,
      date: inJan(5),
      categoryId: ignored.id,
    });

    const result = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [ignored.id],
      fixedCategoryIds: [],
    });

    expect(result.totalSpent).toBe(500);
  });

  it('does not resolve a tag row belonging to another household', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const other = await createHousehold('Other', user.id);
    const ignored = await makeBudgetCategory(user.id, {
      kind: 'ignored',
      plannedAmount: 0,
      householdId: other.id,
    });
    const tagged = await makeTransaction(user.id, { amount: 500, date: inJan(5) });
    await makeTransactionCategory(tagged.id, ignored.id, other.id, user.id);

    const result = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [ignored.id],
      fixedCategoryIds: [],
    });

    expect(result.totalSpent).toBe(500);
  });

  it('a closed (deleted) tag row does not count toward matchedFixedCount', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const rent = await makeBudgetCategory(user.id, {
      kind: 'fixed',
      plannedAmount: 1800,
      householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 1800, date: inJan(5) });
    await makeTransactionCategory(txn.id, rent.id, household.id, user.id, {
      deletedAt: new Date(),
    });

    const result = await aggregateSpend({
      householdId: household.id,
      ownerWindows: since(user.id),
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [rent.id],
    });

    expect(result.matchedFixedCount).toBe(0);
  });
});
