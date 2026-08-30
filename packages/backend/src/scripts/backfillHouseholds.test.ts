import crypto from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { truncateAll, closeTestDb } from '../../test/setup';
import {
  makeBudgetCategory,
  makeBudgetCategoryOverride,
  makeGroup,
  makeHousehold,
  makeHouseholdMember,
  makeTransaction,
  makeUser,
} from '../../test/helpers/factories';
import { db } from '../db/client';
import {
  budgetCategories,
  groupMembers,
  householdMembers,
  households,
  transactionCategories,
  transactions,
} from '../db/schema';
import { backfillHouseholds } from './backfillHouseholds';

afterEach(truncateAll);
afterAll(closeTestDb);

describe('backfillHouseholds', () => {
  it('creates a household per group, carrying its invite code', async () => {
    const user = await makeUser();
    const group = await makeGroup(user.id, { name: 'Flat' });
    await db.insert(groupMembers).values({ groupId: group.id, userId: user.id });

    const report = await backfillHouseholds();

    expect(report.householdsCreated).toBe(1);
    const [household] = await db.select().from(households);
    expect(household.name).toBe('Flat');
    expect(household.inviteCode).toBe(group.inviteCode);
  });

  it('sets membership created_at from the group, not today', async () => {
    const user = await makeUser();
    const joinedLongAgo = new Date('2024-03-01T00:00:00Z');
    const group = await makeGroup(user.id, { createdAt: joinedLongAgo });
    await db.insert(groupMembers).values({ groupId: group.id, userId: user.id });

    await backfillHouseholds();

    const [membership] = await db.select().from(householdMembers);
    expect(membership.createdAt.toISOString()).toBe(joinedLongAgo.toISOString());
  });

  it('gives a user with no group a solo household', async () => {
    const user = await makeUser({ name: 'Ada' });

    const report = await backfillHouseholds();

    expect(report.soloHouseholdsCreated).toBe(1);
    const [household] = await db.select().from(households);
    expect(household.name).toBe("Ada's Household");
  });

  it('keeps the oldest membership when a user is in several groups', async () => {
    const user = await makeUser();
    const older = await makeGroup(user.id, { createdAt: new Date('2024-01-01') });
    const newer = await makeGroup(user.id, { createdAt: new Date('2025-01-01') });
    await db.insert(groupMembers).values([
      { groupId: older.id, userId: user.id },
      { groupId: newer.id, userId: user.id },
    ]);

    const report = await backfillHouseholds();

    expect(report.surplusMembershipsClosed).toBe(1);
    const active = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.userId, user.id),
          isNull(householdMembers.deletedAt)
        )
      );
    expect(active).toHaveLength(1);

    const [kept] = await db
      .select()
      .from(households)
      .where(eq(households.id, active[0].householdId));
    expect(kept.inviteCode).toBe(older.inviteCode);
  });

  it('is a no-op on categoriesAssigned once every category already carries a household', async () => {
    // `budget_categories.household_id` is NOT NULL, so `makeBudgetCategory`
    // always resolves one up front — there is no longer a way to construct
    // a category missing one to exercise the assignment step against.
    const user = await makeUser();
    const category = await makeBudgetCategory(user.id, { name: 'Rent' });

    const report = await backfillHouseholds();

    expect(report.categoriesAssigned).toBe(0);
    const [row] = await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.id, category.id));
    expect(row.householdId).not.toBeNull();
  });

  it('writes a tag row per categorised transaction, preserving created_at', async () => {
    const user = await makeUser();
    const category = await makeBudgetCategory(user.id);
    const taggedAt = new Date('2025-06-15T12:00:00Z');
    const txn = await makeTransaction(user.id, {
      categoryId: category.id,
      createdAt: taggedAt,
    });

    const report = await backfillHouseholds();

    expect(report.tagRowsCreated).toBe(1);
    const [tag] = await db.select().from(transactionCategories);
    expect(tag.transactionId).toBe(txn.id);
    expect(tag.categoryId).toBe(category.id);
    expect(tag.createdBy).toBe(user.id);
    expect(tag.createdAt.toISOString()).toBe(taggedAt.toISOString());
  });

  it('is idempotent', async () => {
    const user = await makeUser();
    const category = await makeBudgetCategory(user.id);
    await makeTransaction(user.id, { categoryId: category.id });

    await backfillHouseholds();
    const householdsAfterFirst = await db.select().from(households);
    const second = await backfillHouseholds();

    expect(second.householdsCreated).toBe(0);
    expect(second.soloHouseholdsCreated).toBe(0);
    expect(second.tagRowsCreated).toBe(0);
    expect(await db.select().from(households)).toHaveLength(
      householdsAfterFirst.length
    );
    expect(await db.select().from(transactionCategories)).toHaveLength(1);
  });

  it('dry-run writes nothing but reports the same counts', async () => {
    // Plain `makeUser`, no budget category: `makeBudgetCategory` would
    // resolve (and persist) a household itself, which is exactly the write
    // this test wants the dry-run's solo-household step to make and roll
    // back instead.
    await makeUser();

    const dry = await backfillHouseholds({ dryRun: true });

    expect(dry.soloHouseholdsCreated).toBe(1);
    expect(await db.select().from(households)).toHaveLength(0);
  });

  it('reports duplicate category names in a shared household', async () => {
    // `makeBudgetCategory` now resolves a household up front (household_id
    // is NOT NULL), so the household must exist and both users must already
    // be members of it before their categories are created — backfill's
    // group-to-household step is exercised elsewhere; this test is only
    // about the duplicate-name report over categories already sharing one.
    const a = await makeUser();
    const b = await makeUser();
    const household = await makeHousehold(a.id);
    await makeHouseholdMember(household.id, b.id);
    await makeBudgetCategory(a.id, { name: 'Groceries', householdId: household.id });
    await makeBudgetCategory(b.id, { name: 'Groceries', householdId: household.id });

    const report = await backfillHouseholds();

    expect(report.duplicateCategoryNames).toEqual([
      expect.objectContaining({ name: 'Groceries' }),
    ]);
  });

  it('retries with a new invite code when the generated one collides, without aborting the run', async () => {
    const user = await makeUser({ name: 'Grace' });
    // A real 4-byte invite code, captured so the mock and the pre-existing
    // household agree on exactly what collides.
    const collidingBytes = crypto.randomBytes(4);
    const collidingCode = collidingBytes.toString('base64url').slice(0, 6);
    const otherOwner = await makeUser();
    await makeHousehold(otherOwner.id, { inviteCode: collidingCode });

    const spy = jest
      .spyOn(crypto, 'randomBytes')
      .mockImplementationOnce(() => collidingBytes);

    try {
      const report = await backfillHouseholds();

      // One solo household for `user` (retried past the collision) and one
      // for `otherOwner`, who has a household row but no membership of their
      // own yet either.
      expect(report.soloHouseholdsCreated).toBe(2);
      const [solo] = await db
        .select()
        .from(households)
        .where(eq(households.createdBy, user.id));
      expect(solo.inviteCode).not.toBe(collidingCode);
    } finally {
      spy.mockRestore();
    }
  });

  it('still reports a duplicate category name on a second run over an already-assigned household', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await makeHousehold(a.id);
    await makeHouseholdMember(household.id, b.id);
    await makeBudgetCategory(a.id, { name: 'Groceries', householdId: household.id });
    await makeBudgetCategory(b.id, { name: 'Groceries', householdId: household.id });

    await backfillHouseholds();
    const second = await backfillHouseholds();

    expect(second.categoriesAssigned).toBe(0);
    expect(second.duplicateCategoryNames).toEqual([
      expect.objectContaining({ name: 'Groceries' }),
    ]);
  });

  it('has nothing to report: the (category, month, year) collision step 7 guards against can no longer be inserted', async () => {
    // Before this migration, two different users could each hold an
    // override on the same (category, month, year) — the exact state
    // step 7 scans for and refuses to proceed past. The DB now enforces
    // `bco_category_month_year_uq` at insert time, so the collision this
    // test used to construct is rejected long before `backfillHouseholds`
    // ever runs.
    const ownerA = await makeUser();
    const ownerB = await makeUser();
    const category = await makeBudgetCategory(ownerA.id);
    await makeBudgetCategoryOverride(ownerA.id, category.id, {
      month: 3,
      year: 2026,
    });

    await expect(
      makeBudgetCategoryOverride(ownerB.id, category.id, {
        month: 3,
        year: 2026,
      })
    ).rejects.toThrow();

    const dry = await backfillHouseholds({ dryRun: true });
    expect(dry.overrideCollisions).toEqual([]);
  });
});
