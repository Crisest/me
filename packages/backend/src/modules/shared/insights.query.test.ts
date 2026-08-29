import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBudgetCategory,
  makeTransaction,
} from '../../../test/helpers/factories';
import { aggregateSpend, getCategoryIdsByKind } from './insights.query';

afterEach(truncateAll);
afterAll(closeTestDb);

const JAN = new Date('2026-01-01T00:00:00Z');
const FEB = new Date('2026-02-01T00:00:00Z');
const inJan = (day: number) => new Date(`2026-01-${String(day).padStart(2, '0')}T12:00:00Z`);

describe('aggregateSpend', () => {
  it('returns zeroes for a user with no transactions', async () => {
    const user = await makeUser();
    const result = await aggregateSpend({
      userIds: [user.id],
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });
    expect(result).toEqual({
      totalSpent: 0,
      debitCount: 0,
      averageDebit: 0,
      totalIncome: 0,
      creditCount: 0,
      averageCredit: 0,
      matchedFixedCount: 0,
    });
  });

  // THE REGRESSION TEST. Mongo's $nin matched documents with no categoryId.
  // SQL NOT IN excludes NULLs. If this fails, spending is under-reported.
  it('counts UNTAGGED debits as spending even when categories are excluded', async () => {
    const user = await makeUser();
    const ignored = await makeBudgetCategory(user.id, {
      name: 'Transfers',
      kind: 'ignored',
      plannedAmount: 0,
    });

    await makeTransaction(user.id, { amount: 100, date: inJan(5) });
    await makeTransaction(user.id, {
      amount: 999,
      date: inJan(6),
      categoryId: ignored.id,
    });

    const result = await aggregateSpend({
      userIds: [user.id],
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
    await makeTransaction(user.id, { amount: 40, date: inJan(5) });

    const result = await aggregateSpend({
      userIds: [user.id],
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });
    expect(result.totalSpent).toBe(40);
  });

  it('separates debits (positive) from credits (negative)', async () => {
    const user = await makeUser();
    await makeTransaction(user.id, { amount: 100, date: inJan(5) });
    await makeTransaction(user.id, { amount: 50, date: inJan(6) });
    await makeTransaction(user.id, { amount: -800, date: inJan(7) });

    const r = await aggregateSpend({
      userIds: [user.id],
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
    const rent = await makeBudgetCategory(user.id, { name: 'Rent', kind: 'fixed' });
    const gym = await makeBudgetCategory(user.id, { name: 'Gym', kind: 'fixed' });

    await makeTransaction(user.id, { amount: 1200, date: inJan(1), categoryId: rent.id });
    await makeTransaction(user.id, { amount: 1200, date: inJan(2), categoryId: rent.id });
    await makeTransaction(user.id, { amount: 40, date: inJan(3), categoryId: gym.id });

    const r = await aggregateSpend({
      userIds: [user.id],
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [rent.id, gym.id],
    });
    expect(r.matchedFixedCount).toBe(2);
  });

  it('respects the date window', async () => {
    const user = await makeUser();
    await makeTransaction(user.id, { amount: 10, date: inJan(31) });
    await makeTransaction(user.id, { amount: 999, date: new Date('2026-02-01T00:00:00Z') });

    const r = await aggregateSpend({
      userIds: [user.id],
      startDate: JAN,
      endDate: FEB,
      excludedCategoryIds: [],
      fixedCategoryIds: [],
    });
    expect(r.totalSpent).toBe(10);
  });

  it('aggregates across multiple users (the group case)', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeTransaction(a.id, { amount: 60, date: inJan(5) });
    await makeTransaction(b.id, { amount: 40, date: inJan(5) });

    const r = await aggregateSpend({
      userIds: [a.id, b.id],
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
    await makeTransaction(user.id, { amount: 12.34, date: inJan(5) });
    const r = await aggregateSpend({
      userIds: [user.id],
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

  it('getCategoryIdsByKind filters by kind and owner', async () => {
    const user = await makeUser();
    const other = await makeUser();
    const ignored = await makeBudgetCategory(user.id, {
      kind: 'ignored',
      plannedAmount: 0,
    });
    await makeBudgetCategory(user.id, { kind: 'flexible' });
    await makeBudgetCategory(other.id, { kind: 'ignored', plannedAmount: 0 });

    expect(await getCategoryIdsByKind([user.id], 'ignored')).toEqual([ignored.id]);
  });
});
