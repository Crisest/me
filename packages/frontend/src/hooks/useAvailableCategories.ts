import { useMemo } from 'react';
import type { BudgetCategory, Transaction } from '@portfolio/common';

export interface UseAvailableCategoriesParams {
  categories: BudgetCategory[] | undefined;
  transactions: Transaction[] | undefined;
  excludeTransactionId?: string;
}

/**
 * Only `fixed` categories are exclusive; a month may hold just one
 * transaction each. Flexible and ignored categories are always available.
 */
export function useAvailableCategories({
  categories,
  transactions,
  excludeTransactionId,
}: UseAvailableCategoriesParams): BudgetCategory[] {
  const claimedIds = useMemo(() => {
    const set = new Set<string>();
    (transactions ?? []).forEach(t => {
      if (t.id !== excludeTransactionId && t.categoryId) set.add(t.categoryId);
    });
    return set;
  }, [transactions, excludeTransactionId]);

  const available = useMemo<BudgetCategory[]>(
    () =>
      (categories ?? []).filter(
        c => c.kind !== 'fixed' || !claimedIds.has(c.id),
      ),
    [categories, claimedIds],
  );

  return available;
}
