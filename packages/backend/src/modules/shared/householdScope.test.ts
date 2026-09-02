import { and, gte, lt } from 'drizzle-orm';
import { db } from '../../db/client';
import { transactions } from '../../db/schema';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeTransaction } from '../../../test/helpers/factories';
import { householdOwnerFilter } from './householdScope';

afterEach(truncateAll);
afterAll(closeTestDb);

const idsMatching = async (
  windows: { userId: string; from: Date; to: Date | null }[]
): Promise<string[]> => {
  const filter = householdOwnerFilter(windows);
  if (!filter) return [];
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(filter);
  return rows.map(r => r.id).sort();
};

describe('householdOwnerFilter', () => {
  it('returns undefined for an empty window list', () => {
    expect(householdOwnerFilter([])).toBeUndefined();
  });

  it('includes transactions from every member', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const txnA = await makeTransaction(a.id, { date: new Date('2026-03-10') });
    const txnB = await makeTransaction(b.id, { date: new Date('2026-03-11') });

    const ids = await idsMatching([
      { userId: a.id, from: new Date('2026-01-01'), to: null },
      { userId: b.id, from: new Date('2026-01-01'), to: null },
    ]);

    expect(ids).toEqual([txnA.id, txnB.id].sort());
  });

  it("excludes a departed member's post-tenure transactions", async () => {
    const user = await makeUser();
    const inside = await makeTransaction(user.id, { date: new Date('2026-02-10') });
    await makeTransaction(user.id, { date: new Date('2026-06-10') });

    const ids = await idsMatching([
      { userId: user.id, from: new Date('2026-01-01'), to: new Date('2026-03-01') },
    ]);

    expect(ids).toEqual([inside.id]);
  });

  it('honours both windows of a left-and-rejoined member', async () => {
    const user = await makeUser();
    const first = await makeTransaction(user.id, { date: new Date('2026-02-10') });
    await makeTransaction(user.id, { date: new Date('2026-04-10') });
    const second = await makeTransaction(user.id, { date: new Date('2026-08-10') });

    const ids = await idsMatching([
      { userId: user.id, from: new Date('2026-01-01'), to: new Date('2026-03-01') },
      { userId: user.id, from: new Date('2026-07-01'), to: null },
    ]);

    expect(ids).toEqual([first.id, second.id].sort());
  });
});
