import { SQL, and, eq, gte, lt, or } from 'drizzle-orm';
import { transactions } from '../../db/schema';
import type { ScopeMember } from '../../middleware/resolveBudgetScope';

/**
 * Which transactions belong to a household.
 *
 * Each member contributes only the transactions dated inside their tenure
 * window, so a departed member's later transactions do not count and a
 * left-and-rejoined member contributes through both of their windows.
 *
 * Returns `undefined` when there are no windows: there is no SQL expression
 * for "match nothing", so callers must short-circuit on it.
 */
export const householdOwnerFilter = (
  windows: ScopeMember[]
): SQL | undefined => {
  if (windows.length === 0) return undefined;

  return or(
    ...windows.map(w => {
      const conds = [
        eq(transactions.createdBy, w.userId),
        gte(transactions.date, w.from),
      ];
      if (w.to) conds.push(lt(transactions.date, w.to));
      return and(...conds)!;
    })
  )!;
};
