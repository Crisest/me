import crypto from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, type Db, type Tx } from '../../db/client';
import {
  households,
  householdMembers,
  users,
  type HouseholdRow,
  type HouseholdMemberRow,
} from '../../db/schema';
import { toHousehold } from './household.mapper';
import { AppError } from '../../middleware/errorHandler';
import type { Household, HouseholdMember } from '@portfolio/common';

const generateInviteCode = () =>
  crypto.randomBytes(4).toString('base64url').slice(0, 6);

const MAX_INVITE_CODE_ATTEMPTS = 3;

export const listActiveMembers = async (
  householdId: string,
  executor: Db | Tx = db
): Promise<HouseholdMember[]> => {
  const rows = await executor
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      joinedAt: householdMembers.createdAt,
    })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        isNull(householdMembers.deletedAt)
      )
    );

  return rows.map(r => ({
    id: r.id,
    email: r.email,
    name: r.name ?? undefined,
    joinedAt: r.joinedAt.toISOString(),
  }));
};

export const getActiveMembership = async (
  userId: string
): Promise<HouseholdMemberRow | undefined> => {
  const [row] = await db
    .select()
    .from(householdMembers)
    .where(
      and(eq(householdMembers.userId, userId), isNull(householdMembers.deletedAt))
    )
    .limit(1);
  return row;
};

/**
 * Closes `userId`'s active membership (if any) inside `executor`, and
 * archives the household it pointed at when that leaves it with no
 * remaining active members. No-op when there is no active membership, so
 * it composes safely with callers (createHousehold, joinByCode,
 * leaveHousehold) that may have already closed it themselves.
 *
 * Callers MUST NOT invoke this when the caller's active membership already
 * points at the destination household (self-join) — closing it would
 * archive the very household about to receive the fresh membership. Guard
 * for that case before calling in.
 */
const closeActiveMembershipAndArchiveIfEmpty = async (
  executor: Db | Tx,
  userId: string
): Promise<void> => {
  const [membership] = await executor
    .select()
    .from(householdMembers)
    .where(
      and(eq(householdMembers.userId, userId), isNull(householdMembers.deletedAt))
    )
    .limit(1);
  if (!membership) return;

  await executor
    .update(householdMembers)
    .set({ deletedAt: new Date() })
    .where(eq(householdMembers.id, membership.id));

  const remaining = await executor
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, membership.householdId),
        isNull(householdMembers.deletedAt)
      )
    )
    .limit(1);

  if (remaining.length === 0) {
    await executor
      .update(households)
      .set({ archived: true })
      .where(eq(households.id, membership.householdId));
  }
};

/**
 * Inserts a household with a unique invite code, retrying up to
 * MAX_INVITE_CODE_ATTEMPTS. Throws (from inside the caller's transaction,
 * per `run`'s caller) rather than returning undefined, so a caller that
 * wraps this in `db.transaction` gets a clean rollback instead of a
 * partially-applied side effect.
 */
const insertHouseholdWithUniqueCode = async (
  tx: Db | Tx,
  name: string,
  createdBy: string
): Promise<HouseholdRow> => {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
    const [household] = await tx
      .insert(households)
      .values({ name, inviteCode: generateInviteCode(), createdBy })
      .onConflictDoNothing({ target: households.inviteCode })
      .returning();
    if (household) return household;
  }
  throw new AppError('Could not generate a unique invite code', 500);
};

/**
 * `executor` defaults to the shared `db` handle, in which case this opens
 * its own transaction. Wave 3's registration hook (and `leaveHousehold`,
 * below) instead pass an open `Tx` so the household creation composes
 * inside a transaction they already hold — the identity check against the
 * `db` singleton is what tells the two cases apart (a nested `PgTransaction`
 * also exposes its own `.transaction()` method, so a structural
 * `'transaction' in executor` check would not).
 *
 * The invite-code insert is secured FIRST; the caller's old membership is
 * only closed (and their old household only archived) once a household row
 * exists. That way a 3-attempt invite-code exhaustion throws before any
 * membership is touched, and — being inside one transaction — rolls back
 * atomically rather than leaving the caller orphaned.
 */
export const createHousehold = async (
  name: string,
  userId: string,
  executor: Db | Tx = db
): Promise<Household> => {
  const run = async (tx: Db | Tx): Promise<HouseholdRow> => {
    const household = await insertHouseholdWithUniqueCode(tx, name, userId);
    await closeActiveMembershipAndArchiveIfEmpty(tx, userId);
    await tx.insert(householdMembers).values({ householdId: household.id, userId });
    return household;
  };

  const row = executor === db ? await db.transaction(run) : await run(executor);
  // When `executor` is an open Tx, this read must go through the same Tx:
  // a separate `db` connection would not yet see the just-inserted, still
  // uncommitted membership row (read-committed isolation).
  const members = await listActiveMembers(row.id, executor);
  return toHousehold(row, members);
};

export const getHouseholdForUser = async (
  userId: string
): Promise<Household | null> => {
  const membership = await getActiveMembership(userId);
  if (!membership) return null;

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, membership.householdId))
    .limit(1);
  if (!household || household.archived) return null;

  const members = await listActiveMembers(household.id);
  return toHousehold(household, members);
};

export const joinByCode = async (
  code: string,
  userId: string
): Promise<Household> => {
  const [household] = await db
    .select()
    .from(households)
    .where(and(eq(households.inviteCode, code), eq(households.archived, false)))
    .limit(1);
  if (!household) {
    throw new AppError('Invalid invite code', 404);
  }

  // Joining your own household by its own code must be a no-op: closing the
  // caller's active membership here would (if they were the last active
  // member) archive the very household the new membership is about to
  // attach to, orphaning it behind `getHouseholdForUser`'s archived filter.
  const currentMembership = await getActiveMembership(userId);
  if (currentMembership?.householdId === household.id) {
    const members = await listActiveMembers(household.id);
    return toHousehold(household, members);
  }

  await db.transaction(async tx => {
    await closeActiveMembershipAndArchiveIfEmpty(tx, userId);
    await tx.insert(householdMembers).values({ householdId: household.id, userId });
  });

  const members = await listActiveMembers(household.id);
  return toHousehold(household, members);
};

export const leaveHousehold = async (
  householdId: string,
  userId: string
): Promise<Household> => {
  const [membership] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
        isNull(householdMembers.deletedAt)
      )
    )
    .limit(1);
  if (!membership) {
    throw new AppError('Member not found in this household', 404);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const label = user?.name ?? user?.email ?? 'User';

  // Close the old membership and create the fresh solo household in one
  // transaction: a failure between the two must not leave the member closed
  // out with no replacement household. createHousehold's executor parameter
  // exists for exactly this composition.
  return db.transaction(async tx => {
    await closeActiveMembershipAndArchiveIfEmpty(tx, userId);
    return createHousehold(`${label}'s Household`, userId, tx);
  });
};

export const removeMember = async (
  householdId: string,
  userId: string
): Promise<Household> => {
  const [membership] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
        isNull(householdMembers.deletedAt)
      )
    )
    .limit(1);
  if (!membership) {
    throw new AppError('Member not found in this household', 404);
  }

  await closeActiveMembershipAndArchiveIfEmpty(db, userId);

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);
  if (!household) {
    throw new AppError('Household not found', 404);
  }

  const members = await listActiveMembers(householdId);
  return toHousehold(household, members);
};

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code?: string }).code === '23505';

export const regenerateInviteCode = async (
  householdId: string
): Promise<Household> => {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
    try {
      const [household] = await db
        .update(households)
        .set({ inviteCode: generateInviteCode() })
        .where(eq(households.id, householdId))
        .returning();
      if (!household) {
        throw new AppError('Household not found', 404);
      }
      const members = await listActiveMembers(householdId);
      return toHousehold(household, members);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new AppError('Could not generate a unique invite code', 500);
};

export const renameHousehold = async (
  householdId: string,
  name: string
): Promise<Household> => {
  const [household] = await db
    .update(households)
    .set({ name })
    .where(eq(households.id, householdId))
    .returning();
  if (!household) {
    throw new AppError('Household not found', 404);
  }

  const members = await listActiveMembers(householdId);
  return toHousehold(household, members);
};
