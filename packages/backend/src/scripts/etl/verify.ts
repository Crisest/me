import { sql } from 'drizzle-orm';
import { openMongo, closeMongo, COLLECTIONS } from './mongo-source';
import { db } from '../../db/client';

export type Check = { name: string; passed: boolean; detail: string };

const COLLECTION_TO_TABLE: Record<string, string> = {
  users: 'users',
  banks: 'banks',
  cards: 'cards',
  accounts: 'accounts',
  budgetcategories: 'budget_categories',
  budgets: 'budgets',
  budgetoverrides: 'budget_overrides',
  budgetcategoryoverrides: 'budget_category_overrides',
  groups: 'groups',
  transactions: 'transactions',
  uploads: 'uploads',
};

/** Half a cent — below this is float representation noise, not a discrepancy. */
const TOLERANCE = 0.005;

export const compareChecksums = (
  mongo: Map<string, number>,
  pg: Map<string, number>
): Check[] => {
  const checks: Check[] = [];
  const keys = new Set([...mongo.keys(), ...pg.keys()]);

  for (const key of keys) {
    const m = mongo.get(key);
    const p = pg.get(key);

    if (m === undefined) {
      checks.push({
        name: `checksum ${key}`,
        passed: false,
        detail: `present in Postgres (${p}) but absent from Mongo`,
      });
      continue;
    }
    if (p === undefined) {
      checks.push({
        name: `checksum ${key}`,
        passed: false,
        detail: `present in Mongo (${m}) but absent from Postgres`,
      });
      continue;
    }
    const diff = Math.abs(m - p);
    checks.push({
      name: `checksum ${key}`,
      passed: diff < TOLERANCE,
      detail:
        diff < TOLERANCE
          ? `${m.toFixed(2)} matches`
          : `mongo=${m.toFixed(2)} postgres=${p.toFixed(2)} diff=${diff.toFixed(4)}`,
    });
  }
  return checks;
};

export const runVerify = async (): Promise<Check[]> => {
  const mongo = await openMongo();
  const checks: Check[] = [];

  try {
    const pgCountOf = async (table: string): Promise<number> => {
      const [{ count }] = (await db.execute(
        sql.raw(`SELECT COUNT(*)::int AS count FROM ${table}`)
      )).rows as unknown as { count: number }[];
      return count;
    };

    // 1. Row counts, per collection against its table.
    for (const collection of COLLECTIONS) {
      const table = COLLECTION_TO_TABLE[collection];
      let mongoCount = await mongo.collection(collection).countDocuments();

      // budget_categories has two sources, and in production only the second
      // one exists: the `budgetcategories` collection was never written to,
      // while every category comes from a `fixedExpenses` entry embedded on a
      // budget. Counting the collection alone would compare 0 against the
      // loaded rows and fail a correct load — or, worse, pass a load that
      // silently dropped every fixed expense.
      if (collection === 'budgetcategories') {
        const embedded = await mongo
          .collection('budgets')
          .aggregate([
            { $project: { n: { $size: { $ifNull: ['$fixedExpenses', []] } } } },
            { $group: { _id: null, total: { $sum: '$n' } } },
          ])
          .toArray();
        mongoCount += (embedded[0]?.total as number) ?? 0;
      }

      const pgCount = await pgCountOf(table);

      checks.push({
        name: `count ${table}`,
        passed: mongoCount === pgCount,
        detail: `mongo=${mongoCount} postgres=${pgCount}`,
      });
    }

    // group_members has no collection of its own — it is built from the
    // `members` array on each group, which the audit treats as the
    // authoritative side of the old two-sided relationship. Without this the
    // membership decision would go entirely unverified.
    const memberAgg = await mongo
      .collection('groups')
      .aggregate([
        { $project: { n: { $size: { $ifNull: ['$members', []] } } } },
        { $group: { _id: null, total: { $sum: '$n' } } },
      ])
      .toArray();
    const mongoMembers = (memberAgg[0]?.total as number) ?? 0;
    const pgMembers = await pgCountOf('group_members');
    checks.push({
      name: 'count group_members',
      passed: mongoMembers === pgMembers,
      detail: `mongo=${mongoMembers} postgres=${pgMembers}`,
    });

    // 2. Financial checksums: SUM(amount) per user per month, to the cent.
    //
    // Mongo user ids do not survive the load (ObjectId -> uuid v7), so the
    // buckets cannot be joined by user id without the id map. Instead each
    // side's per-user-per-month totals are collapsed to a sorted multiset of
    // values and compared position-by-position. This still catches a
    // dropped/duplicated transaction, a wrong amount, or a mis-bucketed date
    // (any of these change the multiset), it just can't say *which* user's
    // bucket is wrong.
    const mongoSums: number[] = [];
    const agg = await mongo
      .collection('transactions')
      .aggregate([
        {
          $group: {
            _id: {
              user: '$createdBy',
              year: { $year: '$date' },
              month: { $month: '$date' },
            },
            total: { $sum: '$amount' },
          },
        },
      ])
      .toArray();
    for (const r of agg) {
      mongoSums.push(r.total as number);
    }

    // Bucket explicitly in UTC. Mongo's $year/$month operators resolve in
    // UTC; to_char(date, 'YYYY-MM') alone resolves in the Postgres session's
    // timezone, which is not pinned anywhere in db/client.ts. Without the
    // "AT TIME ZONE 'UTC'" conversion, a transaction near a month boundary
    // can land in a different bucket on each side whenever the server's
    // timezone setting isn't UTC, producing a false verify failure (or,
    // with two compensating errors, a false pass).
    const pgRows = (await db.execute(
      sql.raw(`
    SELECT SUM(amount)::float8 AS total
    FROM transactions
    GROUP BY created_by, to_char(date AT TIME ZONE 'UTC', 'YYYY-MM')
  `)
    )).rows as unknown as { total: number }[];
    const pgSums: number[] = pgRows.map(r => r.total);

    mongoSums.sort((a, b) => a - b);
    pgSums.sort((a, b) => a - b);

    const mongoBucketMap = new Map(mongoSums.map((v, i) => [`bucket-${i}`, v]));
    const pgBucketMap = new Map(pgSums.map((v, i) => [`bucket-${i}`, v]));
    // Different bucket counts already means unequal Maps below, since a
    // missing key on either side produces a failing Check via compareChecksums.
    checks.push({
      name: 'checksum bucket count',
      passed: mongoSums.length === pgSums.length,
      detail: `mongo=${mongoSums.length} buckets, postgres=${pgSums.length} buckets`,
    });
    checks.push(...compareChecksums(mongoBucketMap, pgBucketMap));

    // 3. Referential completeness — guaranteed by FKs, asserted anyway.
    const orphanQueries: { label: string; sql: string }[] = [
      {
        label: 'transactions.created_by -> users',
        sql: `SELECT COUNT(*)::int AS count FROM transactions t
       LEFT JOIN users u ON u.id = t.created_by WHERE u.id IS NULL`,
      },
      {
        label: 'cards.bank_id -> banks',
        sql: `SELECT COUNT(*)::int AS count FROM cards c
       LEFT JOIN banks b ON b.id = c.bank_id WHERE b.id IS NULL`,
      },
    ];
    for (const q of orphanQueries) {
      const [{ count }] = (await db.execute(sql.raw(q.sql))).rows as unknown as {
        count: number;
      }[];
      checks.push({
        name: `orphan check: ${q.label}`,
        passed: count === 0,
        detail: `${count} orphan(s)`,
      });
    }
  } finally {
    await closeMongo();
  }

  return checks;
};

if (require.main === module) {
  runVerify()
    .then(checks => {
      for (const c of checks) {
        console.log(`${c.passed ? 'PASS' : 'FAIL'}  ${c.name}: ${c.detail}`);
      }
      const failed = checks.filter(c => !c.passed);
      if (failed.length === 0) {
        console.log(`\nVERIFY PASSED: ${checks.length} checks.`);
        process.exit(0);
      }
      console.log(`\nVERIFY FAILED: ${failed.length} of ${checks.length}.`);
      console.log('DO NOT switch traffic.');
      process.exit(1);
    })
    .catch(err => {
      console.error(err);
      process.exit(2);
    });
}
