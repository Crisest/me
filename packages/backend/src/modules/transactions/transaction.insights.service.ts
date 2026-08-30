import { TransactionInsights } from '@portfolio/common';
import { aggregateSpend, getCategoryIdsByHousehold } from '../shared/insights.query';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';

/**
 * `scope` is the caller's resolved BudgetScope (from resolveBudgetScope).
 * `listScope` picks WHOSE spending is aggregated: 'mine' (default) aggregates
 * only `userId`; 'household' aggregates every current member id in
 * `scope.members`. Ignored/fixed category ids are ALWAYS resolved by
 * `scope.householdId`, independent of `listScope` — categories are
 * household-owned, so a category authored by the other member must still be
 * excluded/matched even when the caller is viewing 'mine'.
 */
export const getMonthlyInsights = async (
  scope: BudgetScope,
  userId: string,
  month: number,
  year?: number,
  listScope: 'mine' | 'household' = 'mine'
): Promise<TransactionInsights> => {
  const targetYear = year || new Date().getFullYear();
  // Preserved exactly as-is: LOCAL-time month boundaries (not UTC) — see
  // transaction.service.ts's getAllTransactions for the same convention.
  const startDate = new Date(targetYear, month - 1, 1);
  const endDate = new Date(targetYear, month, 1);

  // Bound each household member by their tenure window, same as
  // getAllTransactions (transaction.service.ts) and budgetSummary.service.ts:
  // a departed member's transactions after they left must not count, and a
  // left-and-rejoined member (two windows, same userId) is not deduplicated.
  const ownerWindows =
    listScope === 'household'
      ? scope.members.map(m => ({ userId: m.userId, from: m.from, to: m.to }))
      : [{ userId, from: new Date(0), to: null }];
  const userIds =
    listScope === 'household' ? scope.members.map(m => m.userId) : [userId];

  const [ignoredIds, fixedIds] = await Promise.all([
    getCategoryIdsByHousehold(scope.householdId, 'ignored'),
    getCategoryIdsByHousehold(scope.householdId, 'fixed'),
  ]);

  const agg = await aggregateSpend({
    userIds,
    ownerWindows,
    startDate,
    endDate,
    excludedCategoryIds: ignoredIds,
    fixedCategoryIds: fixedIds,
    householdId: scope.householdId,
  });

  // aggregateSpend reproduces the raw SUM/AVG over (possibly negative)
  // credit amounts, same as the old $facet pipeline did. The old service
  // applied Math.abs() at this boundary and derived netAmount from the
  // absolute income value — preserved exactly here.
  const totalIncome = Math.abs(agg.totalIncome);
  const averageCredit = Math.abs(agg.averageCredit);

  return {
    totalSpent: agg.totalSpent,
    totalIncome,
    netAmount: totalIncome - agg.totalSpent,
    debitCount: agg.debitCount,
    creditCount: agg.creditCount,
    averageDebit: agg.averageDebit,
    averageCredit,
    matchedFixedCount: agg.matchedFixedCount,
  };
};
