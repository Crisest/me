import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  banks,
  budgetCategories,
  budgetCategoryOverrides,
  budgetOverrides,
  budgets,
  cards,
  groupMembers,
  groups,
  transactions,
  users,
  type GroupRow,
} from '../../db/schema';
import { toGroupWithMembers } from './group.mapper';
import { toTransaction } from '../transactions/transaction.mapper';
import { aggregateSpend, getCategoryIdsByKind } from '../shared/insights.query';
import * as budgetService from '../budget/budget.service';
import { AppError } from '../../middleware/errorHandler';
import {
  GroupWithMembers,
  GroupMember,
  Transaction,
  GroupBudgetInsights,
  Budget,
} from '@portfolio/common';
import crypto from 'crypto';

const generateInviteCode = () =>
  crypto.randomBytes(4).toString('base64url').slice(0, 6);

const MAX_INVITE_CODE_ATTEMPTS = 3;

/** Minimal shape `getMemberBudget` needs from a caller-supplied group. */
export type GroupMembership = { members: string[] };

const fetchMembers = async (groupId: string): Promise<GroupMember[]> => {
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId));

  return rows.map(r => ({ id: r.id, email: r.email, name: r.name ?? undefined }));
};

export const createGroup = async (
  name: string,
  userId: string
): Promise<GroupWithMembers> => {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
    const inviteCode = generateInviteCode();
    const row: GroupRow | undefined = await db.transaction(async tx => {
      const [group] = await tx
        .insert(groups)
        .values({ name, inviteCode, createdBy: userId })
        .onConflictDoNothing({ target: groups.inviteCode })
        .returning();
      if (!group) return undefined;

      await tx.insert(groupMembers).values({ groupId: group.id, userId });
      return group;
    });

    if (row) {
      const members = await fetchMembers(row.id);
      return toGroupWithMembers(row, members);
    }
  }
  throw new AppError('Could not generate a unique invite code', 500);
};

export const joinGroupByCode = async (
  code: string,
  userId: string
): Promise<GroupWithMembers | null> => {
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, code))
    .limit(1);
  if (!group) return null;

  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId })
    .onConflictDoNothing();

  const members = await fetchMembers(group.id);
  return toGroupWithMembers(group, members);
};

/**
 * Mirrors the personal insights logic: matched fixed-category debits are
 * excluded from totalSpent (they are already represented by totalFixed) but
 * counted separately via matchedFixedCount, and ignored-category debits are
 * not spending at all. `excludedCategoryIds` is therefore the UNION of fixed
 * and ignored category ids — the group case's difference from the personal
 * one, which only excludes ignored ids.
 */
const computeGroupInsights = async (
  memberIds: string[],
  month: number,
  year?: number
): Promise<GroupBudgetInsights> => {
  const targetYear = year || new Date().getFullYear();
  const startDate = new Date(targetYear, month - 1, 1);
  const endDate = new Date(targetYear, month, 1);

  const [ignoredIds, fixedCategories] = await Promise.all([
    getCategoryIdsByKind(memberIds, 'ignored'),
    memberIds.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(budgetCategories)
          .where(
            and(
              inArray(budgetCategories.createdBy, memberIds),
              eq(budgetCategories.kind, 'fixed')
            )
          ),
  ]);
  const fixedIds = fixedCategories.map(c => c.id);

  const { totalSpent, debitCount, matchedFixedCount } = await aggregateSpend({
    userIds: memberIds,
    startDate,
    endDate,
    excludedCategoryIds: [...fixedIds, ...ignoredIds],
    fixedCategoryIds: fixedIds,
  });

  const memberBudgets =
    memberIds.length === 0
      ? []
      : await db.select().from(budgets).where(inArray(budgets.createdBy, memberIds));

  const overrides =
    memberIds.length === 0
      ? []
      : await db
          .select()
          .from(budgetOverrides)
          .where(
            and(
              inArray(budgetOverrides.createdBy, memberIds),
              eq(budgetOverrides.month, month),
              eq(budgetOverrides.year, targetYear)
            )
          );
  const overrideByUser = new Map(overrides.map(o => [o.createdBy, o.salary]));

  let budgetTotal = 0;
  let usingActuals = false;
  for (const b of memberBudgets) {
    const override = overrideByUser.get(b.createdBy);
    if (override !== undefined) usingActuals = true;
    budgetTotal += override ?? b.salary;
  }

  const categoryOverrides =
    fixedIds.length === 0
      ? []
      : await db
          .select()
          .from(budgetCategoryOverrides)
          .where(
            and(
              inArray(budgetCategoryOverrides.categoryId, fixedIds),
              eq(budgetCategoryOverrides.month, month),
              eq(budgetCategoryOverrides.year, targetYear)
            )
          );
  const plannedOverrideByCategory = new Map<string, number>(
    categoryOverrides.map(o => [o.categoryId, o.plannedAmount])
  );

  let totalFixed = 0;
  let fixedCount = 0;
  for (const c of fixedCategories) {
    totalFixed += plannedOverrideByCategory.get(c.id) ?? c.plannedAmount;
    fixedCount += 1;
  }

  return {
    totalSpent,
    debitCount,
    budget: budgetTotal,
    totalFixed,
    fixedCount,
    matchedFixedCount,
    usingActuals,
    moneyLeft: budgetTotal - totalFixed - totalSpent,
  };
};

export const getUserGroups = async (
  userId: string,
  month?: number,
  year?: number
): Promise<GroupWithMembers[]> => {
  const rows = await db
    .select({ group: groups })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId));

  const withMembers = await Promise.all(
    rows.map(async ({ group }) => {
      const members = await fetchMembers(group.id);
      return { group, gwm: toGroupWithMembers(group, members) };
    })
  );

  if (!month) {
    return withMembers.map(w => w.gwm);
  }

  return Promise.all(
    withMembers.map(async ({ gwm }) => {
      const memberIds = gwm.members.map(m => m.id);
      const insights = await computeGroupInsights(memberIds, month, year);
      return {
        ...gwm,
        summary: {
          month,
          year: year ?? new Date().getFullYear(),
          budget: insights.budget,
          totalSpent: insights.totalSpent,
          moneyLeft: insights.moneyLeft,
        },
      };
    })
  );
};

export const addUserToGroup = async (
  groupId: string,
  userId: string
): Promise<GroupWithMembers | null> => {
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;

  await db
    .insert(groupMembers)
    .values({ groupId, userId })
    .onConflictDoNothing();

  const members = await fetchMembers(groupId);
  return toGroupWithMembers(group, members);
};

export const removeUserFromGroup = async (
  groupId: string,
  userId: string
): Promise<GroupWithMembers | null> => {
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

  const members = await fetchMembers(groupId);
  return toGroupWithMembers(group, members);
};

export const deleteGroup = async (
  groupId: string,
  userId: string
): Promise<boolean> => {
  // group_members cascades on delete; transactions.groupId is set null on
  // delete (both FK-level, see db/schema/group-members.ts and transactions.ts).
  const result = await db
    .delete(groups)
    .where(and(eq(groups.id, groupId), eq(groups.createdBy, userId)))
    .returning({ id: groups.id });
  return result.length > 0;
};

export const getGroupTransactions = async (
  groupId: string,
  options: { month?: number; year?: number }
): Promise<Transaction[]> => {
  const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw new Error('Group not found');

  const memberRows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const memberIds = memberRows.map(r => r.userId);
  if (memberIds.length === 0) return [];

  const conditions = [inArray(transactions.createdBy, memberIds)];

  const { month, year } = options;
  if (month) {
    const yearSelected = year || new Date().getFullYear();
    const startDate = new Date(yearSelected, month - 1, 1);
    const endDate = new Date(yearSelected, month, 1);
    conditions.push(gte(transactions.date, startDate));
    conditions.push(lt(transactions.date, endDate));
  }

  const rows = await db
    .select({
      transaction: transactions,
      cardName: cards.name,
      bankName: banks.name,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.createdBy))
    .leftJoin(cards, eq(cards.id, transactions.cardId))
    .leftJoin(banks, eq(banks.id, cards.bankId))
    .where(and(...conditions))
    .orderBy(desc(transactions.date));

  return rows.map(r =>
    toTransaction(r.transaction, {
      cardName: r.cardName ?? undefined,
      bankName: r.bankName ?? undefined,
      ownerEmail: r.ownerEmail,
      ownerName: r.ownerName ?? undefined,
    })
  );
};

export const getGroupInsights = async (
  groupId: string,
  month: number,
  year?: number
): Promise<GroupBudgetInsights> => {
  const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw new Error('Group not found');

  const memberRows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const memberIds = memberRows.map(r => r.userId);

  return computeGroupInsights(memberIds, month, year);
};

/**
 * Returns a group member's budget.
 * `group` is the already-loaded membership from requireGroupMembership,
 * so membership of the *caller* is guaranteed before this runs.
 * The userId check below prevents using a group you belong to as a
 * lever to read the budget of someone outside it.
 */
export const getMemberBudget = async (
  group: GroupMembership,
  userId: string
): Promise<Budget | null> => {
  const isMember = group.members.includes(userId);

  if (!isMember) {
    throw new AppError('Member not found in this group', 404);
  }

  return await budgetService.getBudgetByUserId(userId);
};
