import { TransactionInsights } from '@portfolio/common';
import { aggregateSpend, getCategoryIdsByKind } from '../shared/insights.query';

export const getMonthlyInsights = async (
  userId: string,
  month: number,
  year?: number
): Promise<TransactionInsights> => {
  const targetYear = year || new Date().getFullYear();
  // Preserved exactly as-is: LOCAL-time month boundaries (not UTC) — see
  // transaction.service.ts's getAllTransactions for the same convention.
  const startDate = new Date(targetYear, month - 1, 1);
  const endDate = new Date(targetYear, month, 1);

  const [ignoredIds, fixedIds] = await Promise.all([
    getCategoryIdsByKind([userId], 'ignored'),
    getCategoryIdsByKind([userId], 'fixed'),
  ]);

  const agg = await aggregateSpend({
    userIds: [userId],
    startDate,
    endDate,
    excludedCategoryIds: ignoredIds,
    fixedCategoryIds: fixedIds,
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
