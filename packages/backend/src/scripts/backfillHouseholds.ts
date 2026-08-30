import crypto from 'crypto';
import { and, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { db, closeDb, type Tx } from '../db/client';
import {
  budgetCategories,
  budgetCategoryOverrides,
  groupMembers,
  groups,
  householdMembers,
  households,
  transactionCategories,
  transactions,
  users,
} from '../db/schema';

export interface BackfillReport {
  householdsCreated: number;
  membershipsCreated: number;
  soloHouseholdsCreated: number;
  surplusMembershipsClosed: number;
  categoriesAssigned: number;
  tagRowsCreated: number;
  duplicateCategoryNames: { householdId: string; name: string }[];
  overrideCollisions: { categoryId: string; month: number; year: number }[];
}

/** Self-contained: mirrors groups/group.service.ts's generator, not imported from it. */
const generateInviteCode = (): string =>
  crypto.randomBytes(4).toString('base64url').slice(0, 6);

/** Thrown inside the transaction to force a rollback on --dry-run. */
class DryRunRollback extends Error {
  constructor(public report: BackfillReport) {
    super('dry-run rollback');
  }
}

const runBackfill = async (tx: Tx, dryRun: boolean): Promise<BackfillReport> => {
  const report: BackfillReport = {
    householdsCreated: 0,
    membershipsCreated: 0,
    soloHouseholdsCreated: 0,
    surplusMembershipsClosed: 0,
    categoriesAssigned: 0,
    tagRowsCreated: 0,
    duplicateCategoryNames: [],
    overrideCollisions: [],
  };

  // Step 1: one household per group, keyed by shared invite code.
  const allGroups = await tx.select().from(groups);
  const existingHouseholds = await tx.select().from(households);
  const householdByInviteCode = new Map(
    existingHouseholds.map(h => [h.inviteCode, h])
  );

  for (const group of allGroups) {
    if (householdByInviteCode.has(group.inviteCode)) continue;
    const [household] = await tx
      .insert(households)
      .values({
        name: group.name,
        inviteCode: group.inviteCode,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
      })
      .returning();
    householdByInviteCode.set(household.inviteCode, household);
    report.householdsCreated += 1;
  }

  // Step 2: one membership per group_members row. `household_members` now
  // carries a partial unique index on (user_id) WHERE deleted_at IS NULL,
  // so at most one row per user may be active at any instant *within this
  // transaction* — inserting a second active row for the same user (a user
  // in several groups) would violate it immediately, before step 4 ever
  // gets a chance to close the surplus. So the oldest-wins ordering step 4
  // used to apply afterwards is applied inline here instead: rows are
  // processed oldest-group-first, and any later group membership for a
  // user who already has an active one is inserted pre-closed (or, if it
  // turns out to be older than the currently active one, swaps in as the
  // new active row while the old one is closed first).
  const allGroupMembers = await tx.select().from(groupMembers);
  const existingMemberships = await tx.select().from(householdMembers);
  const membershipKey = (householdId: string, userId: string): string =>
    `${householdId}:${userId}`;
  const membershipSet = new Set(
    existingMemberships.map(m => membershipKey(m.householdId, m.userId))
  );
  const groupById = new Map(allGroups.map(g => [g.id, g]));
  const householdById = new Map(
    [...householdByInviteCode.values()].map(h => [h.id, h])
  );

  const activeHouseholdForUser = new Map<
    string,
    { householdId: string; createdAt: Date }
  >();
  for (const m of existingMemberships) {
    if (m.deletedAt) continue;
    const household = householdById.get(m.householdId);
    activeHouseholdForUser.set(m.userId, {
      householdId: m.householdId,
      createdAt: household?.createdAt ?? m.createdAt,
    });
  }

  const sortedGroupMembers = [...allGroupMembers].sort((a, b) => {
    const aCreatedAt = groupById.get(a.groupId)?.createdAt ?? new Date(0);
    const bCreatedAt = groupById.get(b.groupId)?.createdAt ?? new Date(0);
    return aCreatedAt.getTime() - bCreatedAt.getTime();
  });

  for (const gm of sortedGroupMembers) {
    const group = groupById.get(gm.groupId);
    if (!group) continue;
    const household = householdByInviteCode.get(group.inviteCode);
    if (!household) continue;
    const key = membershipKey(household.id, gm.userId);
    if (membershipSet.has(key)) continue;

    const current = activeHouseholdForUser.get(gm.userId);
    let isActive = true;
    if (current) {
      if (group.createdAt.getTime() < current.createdAt.getTime()) {
        // This membership predates the currently active one — it becomes
        // active, and the previously active row is closed first so the
        // two never coexist as active.
        await tx
          .update(householdMembers)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(householdMembers.householdId, current.householdId),
              eq(householdMembers.userId, gm.userId),
              isNull(householdMembers.deletedAt)
            )
          );
        report.surplusMembershipsClosed += 1;
      } else {
        isActive = false;
      }
    }

    await tx.insert(householdMembers).values({
      householdId: household.id,
      userId: gm.userId,
      createdAt: group.createdAt,
      deletedAt: isActive ? null : new Date(),
    });
    membershipSet.add(key);
    report.membershipsCreated += 1;
    if (!isActive) report.surplusMembershipsClosed += 1;
    if (isActive) {
      activeHouseholdForUser.set(gm.userId, {
        householdId: household.id,
        createdAt: group.createdAt,
      });
    }
  }

  // Step 3: solo household for every user with no active membership.
  const allUsers = await tx.select().from(users);
  const activeMemberships = await tx
    .select()
    .from(householdMembers)
    .where(isNull(householdMembers.deletedAt));
  const usersWithActiveMembership = new Set(
    activeMemberships.map(m => m.userId)
  );

  const MAX_INVITE_CODE_ATTEMPTS = 3;
  const insertSoloHousehold = async (
    user: (typeof allUsers)[number]
  ): Promise<typeof households.$inferSelect> => {
    // A caught unique-violation would ABORT the surrounding transaction in
    // Postgres (every subsequent statement fails until rollback), so a
    // collision must never throw here. onConflictDoNothing simply omits the
    // row and returns nothing, leaving the transaction healthy for retry.
    for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt += 1) {
      const [row] = await tx
        .insert(households)
        .values({
          name: `${user.name ?? user.email}'s Household`,
          inviteCode: generateInviteCode(),
          createdBy: user.id,
          createdAt: user.createdAt,
        })
        .onConflictDoNothing({ target: households.inviteCode })
        .returning();
      if (row) return row;
    }
    throw new Error(
      `Could not generate a unique invite code for user ${user.id} after ${MAX_INVITE_CODE_ATTEMPTS} attempts`
    );
  };

  for (const user of allUsers) {
    if (usersWithActiveMembership.has(user.id)) continue;
    const household = await insertSoloHousehold(user);
    await tx.insert(householdMembers).values({
      householdId: household.id,
      userId: user.id,
      createdAt: user.createdAt,
    });
    usersWithActiveMembership.add(user.id);
    report.soloHouseholdsCreated += 1;
  }

  // Step 4: keep the oldest active membership per user, close the rest.
  const allActiveMemberships = await tx
    .select()
    .from(householdMembers)
    .where(isNull(householdMembers.deletedAt));
  const allHouseholds = await tx.select().from(households);
  const householdMap = new Map(allHouseholds.map(h => [h.id, h]));
  const membershipsByUser = new Map<string, typeof allActiveMemberships>();
  for (const m of allActiveMemberships) {
    const list = membershipsByUser.get(m.userId) ?? [];
    list.push(m);
    membershipsByUser.set(m.userId, list);
  }

  for (const [, memberships] of membershipsByUser) {
    if (memberships.length <= 1) continue;
    const sorted = [...memberships].sort((a, b) => {
      const aCreated = householdMap.get(a.householdId)?.createdAt ?? a.createdAt;
      const bCreated = householdMap.get(b.householdId)?.createdAt ?? b.createdAt;
      return aCreated.getTime() - bCreated.getTime();
    });
    const [, ...surplus] = sorted;
    for (const membership of surplus) {
      await tx
        .update(householdMembers)
        .set({ deletedAt: new Date() })
        .where(eq(householdMembers.id, membership.id));
      report.surplusMembershipsClosed += 1;
    }
  }

  // Recompute the definitive active-membership map after step 4's closures,
  // for use by steps 5 and 6.
  const finalActiveMemberships = await tx
    .select()
    .from(householdMembers)
    .where(isNull(householdMembers.deletedAt));
  const activeHouseholdByUser = new Map(
    finalActiveMemberships.map(m => [m.userId, m.householdId])
  );

  // Step 5: stamp household_id onto every category still missing one.
  const unassignedCategories = await tx
    .select()
    .from(budgetCategories)
    .where(isNull(budgetCategories.householdId));

  for (const category of unassignedCategories) {
    const householdId = activeHouseholdByUser.get(category.createdBy);
    if (!householdId) continue;

    await tx
      .update(budgetCategories)
      .set({ householdId })
      .where(eq(budgetCategories.id, category.id));
    report.categoriesAssigned += 1;
  }

  // Duplicate-name detection runs over EVERY category in a household, not
  // just the ones assigned this run: a category already carrying
  // household_id from an earlier (partial or idempotent) run must still be
  // weighed, or a second run over an already-fully-assigned household would
  // silently stop reporting a genuine collision. Report-only: never merges
  // or renames.
  const categoriesForDuplicateCheck = await tx.select().from(budgetCategories);
  const nameCountsByHousehold = new Map<string, Map<string, number>>();
  for (const category of categoriesForDuplicateCheck) {
    if (!category.householdId) continue;
    const counts =
      nameCountsByHousehold.get(category.householdId) ?? new Map<string, number>();
    counts.set(category.name, (counts.get(category.name) ?? 0) + 1);
    nameCountsByHousehold.set(category.householdId, counts);
  }
  for (const [householdId, counts] of nameCountsByHousehold) {
    for (const [name, count] of counts) {
      if (count > 1) {
        report.duplicateCategoryNames.push({ householdId, name });
      }
    }
  }

  // Step 6: one tag row per categorised transaction, per household.
  const categorisedTransactions = await tx
    .select()
    .from(transactions)
    .where(isNotNull(transactions.categoryId));
  const allCategories = await tx.select().from(budgetCategories);
  const categoryById = new Map(allCategories.map(c => [c.id, c]));
  const existingTags = await tx
    .select()
    .from(transactionCategories)
    .where(isNull(transactionCategories.deletedAt));
  const tagKey = (transactionId: string, householdId: string): string =>
    `${transactionId}:${householdId}`;
  const tagSet = new Set(
    existingTags.map(t => tagKey(t.transactionId, t.householdId))
  );

  for (const txn of categorisedTransactions) {
    if (!txn.categoryId) continue;
    const category = categoryById.get(txn.categoryId);
    const householdId = category?.householdId;
    if (!householdId) continue;
    const key = tagKey(txn.id, householdId);
    if (tagSet.has(key)) continue;
    await tx.insert(transactionCategories).values({
      transactionId: txn.id,
      categoryId: txn.categoryId,
      householdId,
      createdBy: txn.createdBy,
      createdAt: txn.createdAt,
    });
    tagSet.add(key);
    report.tagRowsCreated += 1;
  }

  // Step 7: refuse to proceed if any (category, month, year) has collisions.
  const collisions = await tx
    .select({
      categoryId: budgetCategoryOverrides.categoryId,
      month: budgetCategoryOverrides.month,
      year: budgetCategoryOverrides.year,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(budgetCategoryOverrides)
    .groupBy(
      budgetCategoryOverrides.categoryId,
      budgetCategoryOverrides.month,
      budgetCategoryOverrides.year
    )
    .having(sql`COUNT(*) > 1`);

  for (const collision of collisions) {
    report.overrideCollisions.push({
      categoryId: collision.categoryId,
      month: collision.month,
      year: collision.year,
    });
  }

  // In a real run, refuse to proceed: the transaction rolls back so the
  // later constraining migration is never attempted against bad data. In
  // dry-run mode the whole point is to LEARN about collisions before
  // touching production, so report them instead of throwing — the caller
  // still gets a report with `overrideCollisions` populated.
  if (report.overrideCollisions.length > 0 && !dryRun) {
    throw new Error(
      `Found ${report.overrideCollisions.length} (category_id, month, year) collision(s) in budget_category_overrides; resolve before Wave 6's unique constraint can be created.`
    );
  }

  return report;
};

export const backfillHouseholds = async (
  options: { dryRun?: boolean } = {}
): Promise<BackfillReport> => {
  const { dryRun = false } = options;

  if (!dryRun) {
    return db.transaction(tx => runBackfill(tx, false));
  }

  try {
    await db.transaction(async tx => {
      const report = await runBackfill(tx, true);
      throw new DryRunRollback(report);
    });
    // Unreachable: the transaction above always throws.
    throw new Error('dry-run transaction did not roll back as expected');
  } catch (err) {
    if (err instanceof DryRunRollback) {
      return err.report;
    }
    throw err;
  }
};

/* istanbul ignore next -- exercised only when run as a script, not under Jest */
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  backfillHouseholds({ dryRun })
    .then(report => {
      console.log(JSON.stringify(report, null, 2));
      return closeDb();
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
