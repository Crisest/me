import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeBudgetCategory, makeTransaction } from '../../../test/helpers/factories';
import { createHousehold } from '../households/household.service';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { getMonthlyInsights } from './transaction.insights.service';
import { setTransactionCategory } from './transaction.service';

let userId: string;
let householdId: string;
let scope: BudgetScope;
const MAY = new Date('2026-05-10');

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
  const household = await createHousehold('Home', userId);
  householdId = household.id;
  scope = { householdId, members: [{ userId, from: new Date('2020-01-01'), to: null }] };
});

describe('getMonthlyInsights', () => {
  it('counts a fixed-category debit in totalSpent', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 1800, householdId });
    const txn = await makeTransaction(userId, { amount: 1800, date: MAY });
    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });

    const result = await getMonthlyInsights(scope, userId, 5, 2026);

    expect(result.totalSpent).toBe(1800);
  });

  it('reports a fixed-category debit in fixedSpent as well as totalSpent', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 1800, householdId });
    const rent = await makeTransaction(userId, { amount: 1800, date: MAY });
    await setTransactionCategory(scope, userId, rent.id, { categoryId: cat.id });
    await makeTransaction(userId, { amount: 200, date: MAY });

    const result = await getMonthlyInsights(scope, userId, 5, 2026);

    expect(result.totalSpent).toBe(2000);
    expect(result.fixedSpent).toBe(1800);
    expect(result.debitCount).toBe(2);
  });

  it('leaves fixedSpent at zero when nothing is tagged to a fixed category', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible', plannedAmount: 600, householdId });
    const txn = await makeTransaction(userId, { amount: 540, date: MAY });
    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });

    const result = await getMonthlyInsights(scope, userId, 5, 2026);

    expect(result.totalSpent).toBe(540);
    expect(result.fixedSpent).toBe(0);
  });

  it('keeps an ignored-category debit out of fixedSpent and totalSpent alike', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'ignored', plannedAmount: 0, householdId });
    const txn = await makeTransaction(userId, { amount: 1240, date: MAY });
    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });

    const result = await getMonthlyInsights(scope, userId, 5, 2026);

    expect(result.totalSpent).toBe(0);
    expect(result.fixedSpent).toBe(0);
  });

  it('excludes an ignored-category debit from totalSpent', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'ignored', plannedAmount: 0, householdId });
    const txn = await makeTransaction(userId, { amount: 1240, date: MAY });
    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });

    const result = await getMonthlyInsights(scope, userId, 5, 2026);

    expect(result.totalSpent).toBe(0);
    expect(result.debitCount).toBe(0);
  });

  it('counts distinct fixed categories in matchedFixedCount', async () => {
    const rent = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 1800, householdId });
    const phone = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 60, householdId });
    const groceries = await makeBudgetCategory(userId, { kind: 'flexible', plannedAmount: 600, householdId });
    const rentTxn = await makeTransaction(userId, { amount: 1800, date: MAY });
    const phoneTxn = await makeTransaction(userId, { amount: 55, date: MAY });
    const groceriesTxn = await makeTransaction(userId, { amount: 20, date: MAY });
    await setTransactionCategory(scope, userId, rentTxn.id, { categoryId: rent.id });
    await setTransactionCategory(scope, userId, phoneTxn.id, { categoryId: phone.id });
    await setTransactionCategory(scope, userId, groceriesTxn.id, { categoryId: groceries.id });

    const result = await getMonthlyInsights(scope, userId, 5, 2026);

    expect(result.matchedFixedCount).toBe(2);
  });

  it('still reports credits as income', async () => {
    await makeTransaction(userId, { amount: -2000, date: MAY });

    const result = await getMonthlyInsights(scope, userId, 5, 2026);

    expect(result.totalIncome).toBe(2000);
    expect(result.creditCount).toBe(1);
  });

  it('reports totalIncome as positive and netAmount as income minus spend', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'fixed', plannedAmount: 1800, householdId });
    const txn = await makeTransaction(userId, { amount: 1800, date: MAY });
    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });
    await makeTransaction(userId, { amount: -2000, date: MAY });

    const result = await getMonthlyInsights(scope, userId, 5, 2026);

    expect(result.totalIncome).toBe(2000);
    expect(result.averageCredit).toBe(2000);
    expect(result.netAmount).toBe(200);
  });

  describe('scope — mine vs household', () => {
    it('scope=mine totals only the caller\'s spending', async () => {
      const partner = await makeUser();
      await makeTransaction(userId, { amount: 100, date: MAY });
      await makeTransaction(partner.id, { amount: 400, date: MAY });

      const householdScope: BudgetScope = {
        householdId,
        members: [
          { userId, from: new Date('2020-01-01'), to: null },
          { userId: partner.id, from: new Date('2020-01-01'), to: null },
        ],
      };

      const result = await getMonthlyInsights(householdScope, userId, 5, 2026, 'mine');

      expect(result.totalSpent).toBe(100);
    });

    it('scope=household totals both members\' spending', async () => {
      const partner = await makeUser();
      await makeTransaction(userId, { amount: 100, date: MAY });
      await makeTransaction(partner.id, { amount: 400, date: MAY });

      const householdScope: BudgetScope = {
        householdId,
        members: [
          { userId, from: new Date('2020-01-01'), to: null },
          { userId: partner.id, from: new Date('2020-01-01'), to: null },
        ],
      };

      const result = await getMonthlyInsights(householdScope, userId, 5, 2026, 'household');

      expect(result.totalSpent).toBe(500);
    });

    it('excludes an ignored category authored by the OTHER member, even in scope=mine', async () => {
      const partner = await makeUser();
      // Categories are household-owned: this category is authored by the
      // partner but belongs to the shared household, so it must still
      // exclude the caller's own tagged debit.
      const ignoredByPartner = await makeBudgetCategory(partner.id, {
        kind: 'ignored',
        plannedAmount: 0,
        householdId,
      });

      const householdScope: BudgetScope = {
        householdId,
        members: [
          { userId, from: new Date('2020-01-01'), to: null },
          { userId: partner.id, from: new Date('2020-01-01'), to: null },
        ],
      };

      const taggedTxn = await makeTransaction(userId, { amount: 300, date: MAY });
      await setTransactionCategory(householdScope, userId, taggedTxn.id, {
        categoryId: ignoredByPartner.id,
      });
      await makeTransaction(userId, { amount: 50, date: MAY });

      const result = await getMonthlyInsights(householdScope, userId, 5, 2026, 'mine');

      expect(result.totalSpent).toBe(50);
    });

    it('excludes a departed member\'s transactions dated after they left, but counts those before', async () => {
      const partner = await makeUser();
      const leftAt = new Date('2026-05-15');
      await makeTransaction(partner.id, { amount: 100, date: new Date('2026-05-10') });
      await makeTransaction(partner.id, { amount: 400, date: new Date('2026-05-20') });

      const householdScope: BudgetScope = {
        householdId,
        members: [
          { userId, from: new Date('2020-01-01'), to: null },
          { userId: partner.id, from: new Date('2020-01-01'), to: leftAt },
        ],
      };

      const result = await getMonthlyInsights(householdScope, userId, 5, 2026, 'household');

      expect(result.totalSpent).toBe(100);
    });

    it('counts a left-and-rejoined member across both windows, not the gap between them', async () => {
      const partner = await makeUser();
      // Window 1: before 2026-03-01. Gap: March. Window 2: from 2026-04-01.
      await makeTransaction(partner.id, { amount: 100, date: new Date('2026-02-10') });
      await makeTransaction(partner.id, { amount: 500, date: new Date('2026-03-10') }); // in the gap
      await makeTransaction(partner.id, { amount: 200, date: new Date('2026-05-10') });

      const householdScope: BudgetScope = {
        householdId,
        members: [
          { userId, from: new Date('2020-01-01'), to: null },
          {
            userId: partner.id,
            from: new Date('2020-01-01'),
            to: new Date('2026-03-01'),
          },
          { userId: partner.id, from: new Date('2026-04-01'), to: null },
        ],
      };

      const febResult = await getMonthlyInsights(householdScope, userId, 2, 2026, 'household');
      const marResult = await getMonthlyInsights(householdScope, userId, 3, 2026, 'household');
      const mayResult = await getMonthlyInsights(householdScope, userId, 5, 2026, 'household');

      expect(febResult.totalSpent).toBe(100);
      expect(marResult.totalSpent).toBe(0);
      expect(mayResult.totalSpent).toBe(200);
    });
  });

  describe('live tag row resolution (real tagging path, not the legacy column)', () => {
    it('excludes a debit tagged to an ignored category via setTransactionCategory', async () => {
      const cat = await makeBudgetCategory(userId, {
        kind: 'ignored',
        plannedAmount: 0,
        householdId,
      });
      const txn = await makeTransaction(userId, { amount: 1240, date: MAY });
      await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });

      const result = await getMonthlyInsights(scope, userId, 5, 2026);

      expect(result.totalSpent).toBe(0);
      expect(result.debitCount).toBe(0);
    });

    it('counts a debit tagged to a fixed category via setTransactionCategory in matchedFixedCount', async () => {
      const cat = await makeBudgetCategory(userId, {
        kind: 'fixed',
        plannedAmount: 1800,
        householdId,
      });
      const txn = await makeTransaction(userId, { amount: 1800, date: MAY });
      await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });

      const result = await getMonthlyInsights(scope, userId, 5, 2026);

      expect(result.matchedFixedCount).toBe(1);
      expect(result.totalSpent).toBe(1800);
    });
  });
});
