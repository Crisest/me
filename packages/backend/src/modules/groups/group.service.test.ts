import { eq } from 'drizzle-orm';
import {
  createGroup,
  joinGroupByCode,
  getUserGroups,
  removeUserFromGroup,
  deleteGroup,
  getGroupInsights,
  getMemberBudget,
} from './group.service';
import { db } from '../../db/client';
import { budgets, budgetOverrides, groupMembers, transactions } from '../../db/schema';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeGroup, makeBudgetCategory, makeTransaction } from '../../../test/helpers/factories';

afterEach(truncateAll);
afterAll(closeTestDb);

it('uses each member override salary when present, else base salary', async () => {
  const memberA = await makeUser();
  const memberB = await makeUser();
  const group = await makeGroup(memberA.id);
  await db.insert(groupMembers).values([
    { groupId: group.id, userId: memberA.id },
    { groupId: group.id, userId: memberB.id },
  ]);
  await db.insert(budgets).values([
    { createdBy: memberA.id, salary: 5000 },
    { createdBy: memberB.id, salary: 3000 },
  ]);
  // Member A overrides to actual 5500; Member B has no override.
  await db
    .insert(budgetOverrides)
    .values({ createdBy: memberA.id, month: 5, year: 2026, salary: 5500 });

  const result = await getGroupInsights(group.id, 5, 2026);

  expect(result.budget).toBe(8500); // 5500 (override) + 3000 (base)
  expect(result.usingActuals).toBe(true);
});

it('sets usingActuals false when no member has an override', async () => {
  const memberA = await makeUser();
  const group = await makeGroup(memberA.id);
  await db.insert(groupMembers).values({ groupId: group.id, userId: memberA.id });
  await db.insert(budgets).values({ createdBy: memberA.id, salary: 5000 });

  const result = await getGroupInsights(group.id, 5, 2026);

  expect(result.budget).toBe(5000);
  expect(result.usingActuals).toBe(false);
});

it('excludes matched debits from totalSpent and reports matchedFixedCount', async () => {
  const memberA = await makeUser();
  const group = await makeGroup(memberA.id);
  await db.insert(groupMembers).values({ groupId: group.id, userId: memberA.id });
  await db.insert(budgets).values({ createdBy: memberA.id, salary: 5000 });
  const fixed1 = await makeBudgetCategory(memberA.id, { kind: 'fixed', plannedAmount: 800 });
  const fixed2 = await makeBudgetCategory(memberA.id, { kind: 'fixed', plannedAmount: 200 });

  // Untagged debit: counts toward totalSpent.
  await makeTransaction(memberA.id, { amount: 1200, date: new Date('2026-05-10T12:00:00Z') });
  // Matched fixed debits: excluded from totalSpent, counted in matchedFixedCount.
  await makeTransaction(memberA.id, {
    amount: 800,
    categoryId: fixed1.id,
    date: new Date('2026-05-11T12:00:00Z'),
  });
  await makeTransaction(memberA.id, {
    amount: 200,
    categoryId: fixed2.id,
    date: new Date('2026-05-12T12:00:00Z'),
  });

  const result = await getGroupInsights(group.id, 5, 2026);

  expect(result.totalSpent).toBe(1200);
  expect(result.matchedFixedCount).toBe(2);
  expect(result.totalFixed).toBe(1000);
  expect(result.moneyLeft).toBe(5000 - 1000 - 1200); // 2800
});

// THE REGRESSION TEST for the group case's difference from personal insights:
// the exclusion list passed to aggregateSpend must be the UNION of fixed AND
// ignored category ids, not just ignored. If only ignored ids were passed,
// the fixed-category debit below would leak into totalSpent.
it('excludes fixed-category spending from totalSpent as well as ignored (union exclusion)', async () => {
  const memberA = await makeUser();
  const group = await makeGroup(memberA.id);
  await db.insert(groupMembers).values({ groupId: group.id, userId: memberA.id });
  await db.insert(budgets).values({ createdBy: memberA.id, salary: 5000 });
  const fixed = await makeBudgetCategory(memberA.id, { kind: 'fixed', plannedAmount: 500 });
  const ignored = await makeBudgetCategory(memberA.id, {
    kind: 'ignored',
    plannedAmount: 0,
  });

  await makeTransaction(memberA.id, { amount: 100, date: new Date('2026-05-05T12:00:00Z') });
  await makeTransaction(memberA.id, {
    amount: 500,
    categoryId: fixed.id,
    date: new Date('2026-05-06T12:00:00Z'),
  });
  await makeTransaction(memberA.id, {
    amount: 999,
    categoryId: ignored.id,
    date: new Date('2026-05-07T12:00:00Z'),
  });

  const result = await getGroupInsights(group.id, 5, 2026);

  expect(result.totalSpent).toBe(100);
});

it('getUserGroups attaches a monthly summary to each group', async () => {
  const memberA = await makeUser();
  const memberB = await makeUser();
  const group = await makeGroup(memberA.id, { name: 'G' });
  await db.insert(groupMembers).values([
    { groupId: group.id, userId: memberA.id },
    { groupId: group.id, userId: memberB.id },
  ]);
  await db.insert(budgets).values([
    { createdBy: memberA.id, salary: 5000 },
    { createdBy: memberB.id, salary: 3000 },
  ]);
  await makeBudgetCategory(memberA.id, { kind: 'fixed', plannedAmount: 1000 });
  await makeTransaction(memberA.id, { amount: 1200, date: new Date('2026-05-10T12:00:00Z') });

  const result = await getUserGroups(memberA.id, 5, 2026);

  expect(result[0].summary).toEqual({
    month: 5,
    year: 2026,
    budget: 8000, // 5000 + 3000
    totalSpent: 1200,
    moneyLeft: 5800, // 8000 - 1000 (fixed) - 1200 (spent)
  });
});

describe('getMemberBudget', () => {
  it("returns the member's budget", async () => {
    const memberA = await makeUser();
    const memberB = await makeUser();
    await db.insert(budgets).values({ createdBy: memberA.id, salary: 5000 });
    const group = { members: [memberA.id, memberB.id] };

    const result = await getMemberBudget(group, memberA.id);

    expect(result).toMatchObject({ salary: 5000, createdBy: memberA.id });
  });

  it('returns null when the member has no budget document', async () => {
    const memberA = await makeUser();
    const memberB = await makeUser();
    const group = { members: [memberA.id, memberB.id] };

    await expect(getMemberBudget(group, memberB.id)).resolves.toBeNull();
  });

  it('throws 404 for a userId outside the group', async () => {
    const memberA = await makeUser();
    const outsider = await makeUser();
    const group = { members: [memberA.id] };

    await expect(getMemberBudget(group, outsider.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

it('joining twice is idempotent (replaces $addToSet)', async () => {
  const owner = await makeUser();
  const joiner = await makeUser();
  const group = await createGroup('Flat', owner.id);

  await joinGroupByCode(group.inviteCode, joiner.id);
  await joinGroupByCode(group.inviteCode, joiner.id);

  const groupsList = await getUserGroups(joiner.id);
  expect(groupsList).toHaveLength(1);
  expect(groupsList[0].members).toHaveLength(2);
});

it('creates the group and the creator membership atomically', async () => {
  const owner = await makeUser();
  const group = await createGroup('Flat', owner.id);

  const memberships = await getUserGroups(owner.id);
  expect(memberships).toHaveLength(1);
  expect(memberships[0].id).toBe(group.id);
});

it('removing a member does not delete their transactions', async () => {
  const owner = await makeUser();
  const member = await makeUser();
  const group = await createGroup('Flat', owner.id);
  await joinGroupByCode(group.inviteCode, member.id);
  await makeTransaction(member.id, { groupId: group.id, amount: 20 });

  await removeUserFromGroup(group.id, member.id);

  expect(await getUserGroups(member.id)).toEqual([]);
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.createdBy, member.id));
  expect(rows).toHaveLength(1);
});

it('deleting a group removes memberships but keeps transactions', async () => {
  const owner = await makeUser();
  const group = await createGroup('Flat', owner.id);
  const tx = await makeTransaction(owner.id, { groupId: group.id });

  await deleteGroup(group.id, owner.id);

  const [remaining] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, tx.id));
  expect(remaining).toBeDefined();
  expect(remaining.groupId).toBeNull();
});
