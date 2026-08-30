import { eq } from 'drizzle-orm';
import { truncateAll, closeTestDb } from '../../test/setup';
import { makeUser } from '../../test/helpers/factories';
import { db } from '../db/client';
import { households } from '../db/schema';
import { createHousehold, joinByCode } from '../modules/households/household.service';
import { resolveBudgetScope } from './resolveBudgetScope';

afterEach(truncateAll);
afterAll(closeTestDb);

const runMiddleware = async (userId: string) => {
  const req: any = { user: { id: userId } };
  const next = jest.fn();
  await resolveBudgetScope(req, {} as any, next);
  return { req, next };
};

describe('resolveBudgetScope', () => {
  it("attaches the caller's household and its members", async () => {
    const owner = await makeUser();
    const joiner = await makeUser();
    const household = await createHousehold('Home', owner.id);
    await createHousehold('Other', joiner.id);
    await joinByCode(household.inviteCode, joiner.id);

    const { req, next } = await runMiddleware(owner.id);

    expect(next).toHaveBeenCalledWith();
    expect(req.budgetScope.householdId).toBe(household.id);
    expect(req.budgetScope.members).toHaveLength(2);
    expect(req.budgetScope.members[0].from).toBeInstanceOf(Date);
    expect(req.budgetScope.members[0].to).toBeNull();
  });

  it('carries a departed member as a closed window', async () => {
    const owner = await makeUser();
    const joiner = await makeUser();
    const household = await createHousehold('Home', owner.id);
    await createHousehold('Other', joiner.id);
    await joinByCode(household.inviteCode, joiner.id);
    const { removeMember } = await import('../modules/households/household.service');
    await removeMember(household.id, joiner.id);

    const { req } = await runMiddleware(owner.id);

    const departed = req.budgetScope.members.find(
      (m: any) => m.userId === joiner.id
    );
    expect(departed.to).toBeInstanceOf(Date);
  });

  it('creates a solo household when the user has no active membership', async () => {
    const user = await makeUser();

    const { req } = await runMiddleware(user.id);

    expect(req.budgetScope.householdId).toBeDefined();
    expect(req.budgetScope.members).toHaveLength(1);
    expect(await db.select().from(households)).toHaveLength(1);
  });

  it('creates a fresh household when the only one is archived', async () => {
    const user = await makeUser();
    const stale = await createHousehold('Home', user.id);
    await db
      .update(households)
      .set({ archived: true })
      .where(eq(households.id, stale.id));

    const { req } = await runMiddleware(user.id);

    expect(req.budgetScope.householdId).not.toBe(stale.id);
  });
});
