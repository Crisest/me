import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeBank, makeCard } from '../../../test/helpers/factories';
import { createCard, getCardsByUser } from './card.service';

afterEach(truncateAll);
afterAll(closeTestDb);

describe('card.service', () => {
  it('creates a card attached to a bank', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    const card = await createCard(user.id, { name: 'Visa', bankId: bank.id });

    expect(card.name).toBe('Visa');
    expect(card.bankId).toBe(bank.id);
    expect(card.createdBy).toBe(user.id);
  });

  it('rejects a card pointing at a bank that does not exist', async () => {
    const user = await makeUser();
    let caught: Error | undefined;
    try {
      await createCard(user.id, {
        name: 'Ghost',
        bankId: '00000000-0000-7000-8000-000000000000',
      });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    // drizzle-orm@0.45.2 surfaces the Postgres error text on `error.cause`,
    // not `error.message`.
    expect((caught?.cause as Error | undefined)?.message).toMatch(
      /foreign key/i
    );
  });

  it('returns only the requesting user cards', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const bankA = await makeBank(a.id);
    const bankB = await makeBank(b.id);
    await makeCard(a.id, bankA.id, { name: 'Mine' });
    await makeCard(b.id, bankB.id, { name: 'Theirs' });

    const cards = await getCardsByUser(a.id);
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe('Mine');
  });

  it('cascades card deletion when its bank is deleted', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    await makeCard(user.id, bank.id);

    const { db } = await import('../../db/client');
    const { banks } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(banks).where(eq(banks.id, bank.id));

    expect(await getCardsByUser(user.id)).toEqual([]);
  });
});
