import { ALL_ACCOUNTS_ID } from '@/hooks/useAccountFilter';
import type { SortDirection } from '@/components/TransactionsTable/TransactionsTable';
import type { Scope } from '@/components/ScopeToggle/ScopeToggle';

export function countActiveFilters(f: {
  selectedAccountId: string;
  sortDirection: SortDirection;
  scope?: Scope;
}): number {
  return (
    Number(f.selectedAccountId !== ALL_ACCOUNTS_ID) +
    Number(f.sortDirection !== 'newest') +
    Number(f.scope === 'household')
  );
}
