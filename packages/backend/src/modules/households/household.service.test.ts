import crypto from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeHousehold } from '../../../test/helpers/factories';
import { db } from '../../db/client';
import { householdMembers, households } from '../../db/schema';
import {
  createHousehold,
  getActiveMembership,
  getHouseholdForUser,
  joinByCode,
  leaveHousehold,
  listActiveMembers,
  regenerateInviteCode,
  removeMember,
} from './household.service';

afterEach(truncateAll);
afterAll(closeTestDb);

describe('createHousehold', () => {
  it('creates the household and an active membership for the creator', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);

    expect(household.name).toBe('Home');
    expect(household.inviteCode).toHaveLength(6);
    expect(household.archived).toBe(false);
    expect(household.members.map(m => m.id)).toEqual([user.id]);

    const membership = await getActiveMembership(user.id);
    expect(membership?.householdId).toBe(household.id);
    expect(membership?.deletedAt).toBeNull();
  });

  it('rolls back cleanly when the invite code cannot be made unique', async () => {
    const user = await makeUser();
    const existing = await createHousehold('Existing', user.id);

    // Force every generated code to collide with a pre-existing household.
    const fixedBuffer = Buffer.alloc(4, 1);
    const fixedCode = fixedBuffer.toString('base64url').slice(0, 6);
    await makeHousehold(user.id, { inviteCode: fixedCode });
    const spy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(fixedBuffer as never);

    try {
      await expect(createHousehold('New', user.id)).rejects.toMatchObject({
        statusCode: 500,
      });
    } finally {
      spy.mockRestore();
    }

    const membership = await getActiveMembership(user.id);
    expect(membership?.householdId).toBe(existing.id);

    const [stillLive] = await db
      .select()
      .from(households)
      .where(eq(households.id, existing.id));
    expect(stillLive.archived).toBe(false);
  });
});

describe('joinByCode', () => {
  it('moves the joiner and archives their emptied household', async () => {
    const owner = await makeUser();
    const joiner = await makeUser();
    const target = await createHousehold('Target', owner.id);
    const original = await createHousehold('Original', joiner.id);

    const joined = await joinByCode(target.inviteCode, joiner.id);

    expect(joined.id).toBe(target.id);
    expect(joined.members).toHaveLength(2);

    const [archived] = await db
      .select()
      .from(households)
      .where(eq(households.id, original.id));
    expect(archived.archived).toBe(true);

    const active = await getActiveMembership(joiner.id);
    expect(active?.householdId).toBe(target.id);
  });

  it('rejects an unknown code', async () => {
    const user = await makeUser();
    await createHousehold('Home', user.id);
    await expect(joinByCode('nope00', user.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('leaves a second tenure as a separate row after a rejoin', async () => {
    const owner = await makeUser();
    const joiner = await makeUser();
    const target = await createHousehold('Target', owner.id);
    await createHousehold('Original', joiner.id);

    await joinByCode(target.inviteCode, joiner.id);
    await leaveHousehold(target.id, joiner.id);
    await joinByCode(target.inviteCode, joiner.id);

    const rows = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.userId, joiner.id),
          eq(householdMembers.householdId, target.id)
        )
      );
    expect(rows).toHaveLength(2);
    expect(rows.filter(r => r.deletedAt === null)).toHaveLength(1);
  });

  it('is a no-op when the caller rejoins their own household by its own code', async () => {
    const user = await makeUser();
    const home = await createHousehold('Home', user.id);

    const rejoined = await joinByCode(home.inviteCode, user.id);

    expect(rejoined.id).toBe(home.id);
    expect(rejoined.archived).toBe(false);

    const [row] = await db
      .select()
      .from(households)
      .where(eq(households.id, home.id));
    expect(row.archived).toBe(false);

    const rows = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.userId, user.id),
          eq(householdMembers.householdId, home.id)
        )
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].deletedAt).toBeNull();
  });
});

describe('leaveHousehold', () => {
  it('closes the membership and returns a fresh solo household', async () => {
    const owner = await makeUser();
    const joiner = await makeUser();
    const target = await createHousehold('Target', owner.id);
    await createHousehold('Original', joiner.id);
    await joinByCode(target.inviteCode, joiner.id);

    const fresh = await leaveHousehold(target.id, joiner.id);

    expect(fresh.id).not.toBe(target.id);
    expect(fresh.members.map(m => m.id)).toEqual([joiner.id]);
    expect(await listActiveMembers(target.id)).toHaveLength(1);
  });
});

describe('removeMember', () => {
  it("closes the removed member's membership", async () => {
    const owner = await makeUser();
    const joiner = await makeUser();
    const target = await createHousehold('Target', owner.id);
    await createHousehold('Original', joiner.id);
    await joinByCode(target.inviteCode, joiner.id);

    const after = await removeMember(target.id, joiner.id);

    expect(after.members.map(m => m.id)).toEqual([owner.id]);
    expect(await getActiveMembership(joiner.id)).toBeUndefined();
  });
});

describe('regenerateInviteCode', () => {
  it('replaces the code and keeps the household otherwise intact', async () => {
    const user = await makeUser();
    const before = await createHousehold('Home', user.id);
    const after = await regenerateInviteCode(before.id);

    expect(after.id).toBe(before.id);
    expect(after.inviteCode).not.toBe(before.inviteCode);
    expect(after.inviteCode).toHaveLength(6);
  });
});

describe('getHouseholdForUser', () => {
  it('returns null when the user has no active membership', async () => {
    const user = await makeUser();
    expect(await getHouseholdForUser(user.id)).toBeNull();
  });

  it('ignores archived households', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await db
      .update(households)
      .set({ archived: true })
      .where(eq(households.id, household.id));

    expect(await getHouseholdForUser(user.id)).toBeNull();
  });
});
