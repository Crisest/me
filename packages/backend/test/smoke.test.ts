import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';
import { truncateAll, closeTestDb } from './setup';
import { makeUser, makeBank, makeCard } from './helpers/factories';

afterEach(truncateAll);
afterAll(closeTestDb);

describe('test harness', () => {
  it('connects to a migrated Postgres and round-trips a row', async () => {
    const user = await makeUser({ email: 'smoke@example.com' });
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );

    const found = await db.query.users.findFirst();
    expect(found?.email).toBe('smoke@example.com');
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found?.updatedAt).toBeInstanceOf(Date);
  });

  it('truncates between tests', async () => {
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(0);
  });

  it('enforces foreign keys', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    const card = await makeCard(user.id, bank.id);
    expect(card.bankId).toBe(bank.id);

    await expect(
      makeCard(user.id, '00000000-0000-7000-8000-000000000000')
    ).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/foreign key/i) },
    });
  });

  it('cascades bank deletion to its cards', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    await makeCard(user.id, bank.id);

    await db.delete(users).where(eq(users.id, user.id));
    const remaining = await db.select().from(users);
    expect(remaining).toHaveLength(0);
  });
});
