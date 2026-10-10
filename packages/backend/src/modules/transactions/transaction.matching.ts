/**
 * How far an incoming row's date may drift from the existing row it
 * duplicates. Plaid can report a different date for the same purchase
 * (authorised vs posted), and CSV dates differ from Plaid's again.
 */
export const MATCH_DATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export const normaliseDescription = (d: string): string =>
  d.trim().toLowerCase().replace(/\s+/g, ' ');

/** Compares money as integer cents — 9.99 never equals 9.99 in float land. */
export const toCents = (amount: number): number => Math.round(amount * 100);

export interface MatchRow {
  accountId: string | null | undefined;
  amount: number;
  description: string;
  date: Date;
}

/**
 * For each incoming row, in order, the id of the existing row it duplicates,
 * or null. An existing row is claimed by at most one incoming row.
 *
 * Description is not part of the key (BMO CSV descriptions differ from
 * Plaid's merchant names); among eligible candidates an equal description
 * wins, then the closest date. Claiming once is what keeps two identical
 * same-day purchases as two rows.
 */
export function matchToExisting(
  incoming: MatchRow[],
  existing: (MatchRow & { id: string })[]
): (string | null)[] {
  const bucketKey = (r: MatchRow): string | null =>
    r.accountId ? `${r.accountId}|${toCents(r.amount)}` : null;

  const buckets = new Map<string, (MatchRow & { id: string })[]>();
  for (const row of existing) {
    const key = bucketKey(row);
    if (key === null) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  return incoming.map(row => {
    const key = bucketKey(row);
    const bucket = key === null ? undefined : buckets.get(key);
    if (!bucket) return null;

    const desc = normaliseDescription(row.description);
    // ponytail: linear scan of the bucket per incoming row. Buckets share
    // account + exact amount, so they stay tiny; if one ever grows large,
    // sort by date and binary-search the window.
    let bestIndex = -1;
    let bestMiss = 2;
    let bestDelta = Infinity;
    bucket.forEach((c, i) => {
      const delta = Math.abs(c.date.getTime() - row.date.getTime());
      if (delta > MATCH_DATE_WINDOW_MS) return;
      const miss = normaliseDescription(c.description) === desc ? 0 : 1;
      if (miss < bestMiss || (miss === bestMiss && delta < bestDelta)) {
        bestMiss = miss;
        bestDelta = delta;
        bestIndex = i;
      }
    });

    if (bestIndex === -1) return null;
    return bucket.splice(bestIndex, 1)[0].id;
  });
}
