import type { BudgetMonthSnapshot } from '@portfolio/common';
import type { BudgetMonthSnapshotRow } from '../../db/schema';

/**
 * `created_at` is the close time — there is no separate `closed_at` column,
 * so the DTO renames it rather than inventing one.
 */
export const toBudgetMonthSnapshot = (
  row: BudgetMonthSnapshotRow
): BudgetMonthSnapshot => ({
  id: row.id,
  householdId: row.householdId,
  month: row.month,
  year: row.year,
  version: row.version,
  members: row.members,
  summary: row.summary,
  transactions: row.transactions,
  closedBy: row.closedBy,
  closedAt: row.createdAt.getTime(),
  supersededAt: row.supersededAt?.getTime(),
});
