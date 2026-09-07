import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeTransaction,
  makeBudgetCategory,
  makeTransactionCategory,
} from '../../../test/helpers/factories';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  budgets,
  budgetCategories,
  budgetOverrides,
  budgetMonthSnapshots,
} from '../../db/schema';
import { createHousehold, joinByCode } from '../households/household.service';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { getBudgetSummary } from './budgetSummary.service';
import { closeMonth, getMonthCloseState } from './monthClose.service';

afterEach(truncateAll);
afterAll(closeTestDb);

const MARCH = new Date(2026, 2, 10);

const soloScope = (householdId: string, userId: string): BudgetScope => ({
  householdId,
  members: [{ userId, from: new Date('2000-01-01'), to: null }],
});

/** A household whose March is ready to close: income filed, nothing untagged. */
const readyHousehold = async () => {
  const user = await makeUser();
  const household = await createHousehold('Home', user.id);
  await db.insert(budgets).values({ salary: 5000, createdBy: user.id });
  await db
    .insert(budgetOverrides)
    .values({ month: 3, year: 2026, salary: 4700, createdBy: user.id });
  const category = await makeBudgetCategory(user.id, {
    name: 'Groceries',
    kind: 'flexible',
    plannedAmount: 600,
    householdId: household.id,
  });
  const txn = await makeTransaction(user.id, {
    amount: 61.25,
    description: 'Groceries',
    date: MARCH,
  });
  await makeTransactionCategory(txn.id, category.id, household.id, user.id);
  return { user, household, category, txn, scope: soloScope(household.id, user.id) };
};

describe('closeMonth', () => {
  it('freezes the summary, the rows and the membership together', async () => {
    const { user, scope, txn, category } = await readyHousehold();

    const row = await closeMonth(scope, user.id, 3, 2026);

    expect(row.version).toBe(1);
    expect(row.closedBy).toBe(user.id);
    expect(row.summary.income).toBe(4700);
    expect(row.summary.byMember[0].isActual).toBe(true);
    expect(row.transactions).toHaveLength(1);
    expect(row.transactions[0]).toMatchObject({
      id: txn.id,
      categoryId: category.id,
      amount: 61.25,
    });
    expect(row.members[0].userId).toBe(user.id);
  });

  it('rejects a month with untagged debits', async () => {
    const { user, scope } = await readyHousehold();
    await makeTransaction(user.id, { amount: 95, date: MARCH });

    await expect(closeMonth(scope, user.id, 3, 2026)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('untagged'),
    });
  });

  it('rejects when a member has not filed their own income', async () => {
    const { household, user, scope } = await readyHousehold();
    const joiner = await makeUser({ name: 'Bo' });
    await joinByCode(household.inviteCode, joiner.id);
    await db.insert(budgets).values({ salary: 3000, createdBy: joiner.id });

    const twoMemberScope: BudgetScope = {
      householdId: household.id,
      members: [
        { userId: user.id, from: new Date('2000-01-01'), to: null },
        { userId: joiner.id, from: new Date('2000-01-01'), to: null },
      ],
    };

    await expect(
      closeMonth(twoMemberScope, user.id, 3, 2026)
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Bo'),
    });
  });

  it('writes nothing when a precondition fails', async () => {
    const { user, scope } = await readyHousehold();
    await makeTransaction(user.id, { amount: 95, date: MARCH });

    await expect(closeMonth(scope, user.id, 3, 2026)).rejects.toThrow();

    expect(await db.select().from(budgetMonthSnapshots)).toHaveLength(0);
  });

  it('refuses to close the same month twice', async () => {
    const { user, scope } = await readyHousehold();
    await closeMonth(scope, user.id, 3, 2026);

    await expect(closeMonth(scope, user.id, 3, 2026)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('makes the summary resolve from the snapshot afterwards', async () => {
    const { user, scope, category } = await readyHousehold();
    await closeMonth(scope, user.id, 3, 2026);

    // Move live state that the snapshot's OWN member and category depend on.
    // Mutating an unrelated user's budget would pass with or without the
    // short-circuit and prove nothing.
    await db
      .update(budgetOverrides)
      .set({ salary: 9999 })
      .where(eq(budgetOverrides.createdBy, user.id));
    await db
      .update(budgetCategories)
      .set({ name: 'Renamed', plannedAmount: 1 })
      .where(eq(budgetCategories.id, category.id));

    const after = await getBudgetSummary(scope, 3, 2026);

    expect(after.income).toBe(4700);
    const frozen = after.categories.find(c => c.categoryId === category.id)!;
    expect(frozen.name).toBe('Groceries');
    expect(frozen.actual).toBe(61.25);
  });
});

describe('getMonthCloseState', () => {
  it('reports an open month with its blockers', async () => {
    const { user, scope } = await readyHousehold();
    await makeTransaction(user.id, { amount: 95, date: MARCH });
    const summary = await getBudgetSummary(scope, 3, 2026);

    const state = await getMonthCloseState(scope, summary, 3, 2026);

    expect(state.closed).toBe(false);
    expect(state.lateTransactionCount).toBe(0);
    expect(state.readiness.untaggedCount).toBe(1);
    expect(state.readiness.canClose).toBe(false);
  });

  it('reports a closed month with who closed it and when', async () => {
    const { user, scope } = await readyHousehold();
    const row = await closeMonth(scope, user.id, 3, 2026);
    const summary = await getBudgetSummary(scope, 3, 2026);

    const state = await getMonthCloseState(scope, summary, 3, 2026);

    expect(state.closed).toBe(true);
    expect(state.snapshotId).toBe(row.id);
    expect(state.closedBy).toBe(user.id);
    expect(state.closedAt).toBe(row.createdAt.getTime());
    // Never "ready to close" once it is closed.
    expect(state.readiness.canClose).toBe(false);
  });

  it('counts transactions that landed after the close', async () => {
    const { user, scope } = await readyHousehold();
    await closeMonth(scope, user.id, 3, 2026);
    await makeTransaction(user.id, { amount: 95, date: MARCH });
    const summary = await getBudgetSummary(scope, 3, 2026);

    const state = await getMonthCloseState(scope, summary, 3, 2026);

    expect(state.lateTransactionCount).toBe(1);
    // The frozen totals do not move to absorb it.
    expect(state.closed).toBe(true);
    expect(summary.untagged.transactionCount).toBe(0);
  });
});
