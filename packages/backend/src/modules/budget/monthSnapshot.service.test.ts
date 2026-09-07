import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBank,
  makeCard,
  makeTransaction,
  makeBudgetCategory,
  makeTransactionCategory,
  makeBudgetMonthSnapshot,
  emptySnapshotSummary,
} from '../../../test/helpers/factories';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { createHousehold } from '../households/household.service';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import {
  getLiveSnapshot,
  listSnapshotTransactions,
  insertSnapshot,
  countLateTransactions,
} from './monthSnapshot.service';
import { toBudgetMonthSnapshot } from './monthSnapshot.mapper';

afterEach(truncateAll);
afterAll(closeTestDb);

const MARCH = new Date(2026, 2, 10);

const soloScope = (householdId: string, userId: string): BudgetScope => ({
  householdId,
  members: [{ userId, from: new Date('2000-01-01'), to: null }],
});

describe('getLiveSnapshot', () => {
  it('returns nothing for an open month', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);

    expect(await getLiveSnapshot(household.id, 3, 2026)).toBeUndefined();
  });

  it('finds the snapshot for a closed month', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const row = await makeBudgetMonthSnapshot(household.id, user.id, {
      month: 3,
      year: 2026,
    });

    expect((await getLiveSnapshot(household.id, 3, 2026))!.id).toBe(row.id);
  });

  it('ignores a superseded snapshot', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeBudgetMonthSnapshot(household.id, user.id, {
      month: 3,
      year: 2026,
      supersededAt: new Date(),
    });

    expect(await getLiveSnapshot(household.id, 3, 2026)).toBeUndefined();
  });

  it('does not leak another household\'s snapshot', async () => {
    const mine = await makeUser();
    const theirs = await makeUser();
    const a = await createHousehold('Mine', mine.id);
    const b = await createHousehold('Theirs', theirs.id);
    await makeBudgetMonthSnapshot(b.id, theirs.id, { month: 3, year: 2026 });

    expect(await getLiveSnapshot(a.id, 3, 2026)).toBeUndefined();
  });
});

describe('listSnapshotTransactions', () => {
  it('denormalises owner, card and category onto each row', async () => {
    const user = await makeUser({ name: 'Ada', email: 'ada@example.com' });
    const household = await createHousehold('Home', user.id);
    const bank = await makeBank(user.id);
    const card = await makeCard(user.id, bank.id, { name: 'Visa' });
    const category = await makeBudgetCategory(user.id, {
      kind: 'flexible',
      plannedAmount: 600,
      householdId: household.id,
    });
    const txn = await makeTransaction(user.id, {
      amount: 61.25,
      description: 'Groceries',
      date: MARCH,
      cardId: card.id,
    });
    await makeTransactionCategory(txn.id, category.id, household.id, user.id);

    const rows = await listSnapshotTransactions(
      soloScope(household.id, user.id),
      3,
      2026
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: txn.id,
      date: txn.date.toISOString(),
      description: 'Groceries',
      amount: 61.25,
      categoryId: category.id,
      ownerId: user.id,
      ownerName: 'Ada',
      ownerEmail: 'ada@example.com',
      cardName: 'Visa',
    });
  });

  it('excludes credits, matching the summary\'s amount > 0 filter', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const category = await makeBudgetCategory(user.id, {
      kind: 'flexible',
      plannedAmount: 600,
      householdId: household.id,
    });
    const refund = await makeTransaction(user.id, { amount: -40, date: MARCH });
    await makeTransactionCategory(refund.id, category.id, household.id, user.id);

    const rows = await listSnapshotTransactions(
      soloScope(household.id, user.id),
      3,
      2026
    );

    expect(rows).toHaveLength(0);
  });

  it('excludes another month', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const category = await makeBudgetCategory(user.id, {
      kind: 'flexible',
      plannedAmount: 600,
      householdId: household.id,
    });
    const april = await makeTransaction(user.id, {
      amount: 10,
      date: new Date(2026, 3, 2),
    });
    await makeTransactionCategory(april.id, category.id, household.id, user.id);

    expect(
      await listSnapshotTransactions(soloScope(household.id, user.id), 3, 2026)
    ).toHaveLength(0);
  });

  it('excludes an untagged debit, whoever it belongs to', async () => {
    // Precondition 1 means this state cannot reach a real close — an untagged
    // debit blocks the month. The row is excluded rather than frozen with a
    // null category, so a snapshot can never carry an uncategorised row.
    const owner = await makeUser();
    const departed = await makeUser();
    const household = await createHousehold('Home', owner.id);
    await makeTransaction(departed.id, { amount: 99, date: MARCH });

    const rows = await listSnapshotTransactions(
      {
        householdId: household.id,
        members: [
          { userId: owner.id, from: new Date('2000-01-01'), to: null },
          {
            userId: departed.id,
            from: new Date('2026-01-01'),
            to: new Date('2026-02-01'),
          },
        ],
      },
      3,
      2026
    );

    expect(rows).toHaveLength(0);
  });

  it('orders by date ascending so the PDF reads chronologically', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const category = await makeBudgetCategory(user.id, {
      kind: 'flexible',
      plannedAmount: 600,
      householdId: household.id,
    });
    const late = await makeTransaction(user.id, {
      amount: 10,
      date: new Date(2026, 2, 20),
    });
    const early = await makeTransaction(user.id, {
      amount: 20,
      date: new Date(2026, 2, 2),
    });
    await makeTransactionCategory(late.id, category.id, household.id, user.id);
    await makeTransactionCategory(early.id, category.id, household.id, user.id);

    const rows = await listSnapshotTransactions(
      soloScope(household.id, user.id),
      3,
      2026
    );

    expect(rows.map(r => r.id)).toEqual([early.id, late.id]);
  });
});

describe('insertSnapshot', () => {
  it('writes version 1 with a null supersededAt', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);

    const row = await insertSnapshot({
      scope: soloScope(household.id, user.id),
      month: 3,
      year: 2026,
      summary: emptySnapshotSummary(3, 2026, 5000),
      transactions: [],
      closedBy: user.id,
    });

    expect(row.version).toBe(1);
    expect(row.supersededAt).toBeNull();
    expect(row.closedBy).toBe(user.id);
    expect(row.summary.income).toBe(5000);
  });

  it('freezes membership windows as ISO strings', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);

    const row = await insertSnapshot({
      scope: {
        householdId: household.id,
        members: [
          {
            userId: user.id,
            from: new Date('2026-01-01T00:00:00.000Z'),
            to: new Date('2026-06-01T00:00:00.000Z'),
          },
        ],
      },
      month: 3,
      year: 2026,
      summary: emptySnapshotSummary(3, 2026),
      transactions: [],
      closedBy: user.id,
    });

    expect(row.members).toEqual([
      {
        userId: user.id,
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-06-01T00:00:00.000Z',
      },
    ]);
  });

  it('rejects a second close of the same month', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const input = {
      scope: soloScope(household.id, user.id),
      month: 3,
      year: 2026,
      summary: emptySnapshotSummary(3, 2026),
      transactions: [],
      closedBy: user.id,
    };
    await insertSnapshot(input);

    await expect(insertSnapshot(input)).rejects.toMatchObject({
      cause: { code: '23505' },
    });
  });
});

describe('countLateTransactions', () => {
  // `transactions.created_at` is defaultNow() — the DATABASE clock. Taking the
  // cutoff from `new Date()` in Node compares two different clocks and flakes
  // on any skew against the Testcontainers Postgres. Every cutoff here comes
  // from a row Postgres wrote, which is also what production does
  // (`snapshot.createdAt`).
  // `db.execute` is raw: node-postgres hands back whatever the driver parsed,
  // not a drizzle-mapped column, so `now` arrives as a string. Construct the
  // Date here rather than letting a lying annotation leak one downstream.
  const dbNow = async (): Promise<Date> => {
    const [row] = await db.execute<{ now: string }>(sql`SELECT now() AS now`)
      .then(r => r.rows);
    return new Date(row.now);
  };

  it('counts only rows created after the close time', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const scope = soloScope(household.id, user.id);
    await makeTransaction(user.id, { amount: 10, date: MARCH });

    const closedAt = await dbNow();
    await makeTransaction(user.id, { amount: 95, date: MARCH });

    expect(await countLateTransactions(scope, 3, 2026, closedAt)).toBe(1);
  });

  it('ignores a late row dated outside the closed month', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const scope = soloScope(household.id, user.id);
    const closedAt = await dbNow();
    await makeTransaction(user.id, { amount: 95, date: new Date(2026, 3, 2) });

    expect(await countLateTransactions(scope, 3, 2026, closedAt)).toBe(0);
  });
});

describe('toBudgetMonthSnapshot', () => {
  it('maps timestamps to epoch ms and drops a null supersededAt', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const row = await makeBudgetMonthSnapshot(household.id, user.id);

    const dto = toBudgetMonthSnapshot(row);

    expect(dto.closedAt).toBe(row.createdAt.getTime());
    expect(dto.supersededAt).toBeUndefined();
    expect(dto.id).toBe(row.id);
  });
});
