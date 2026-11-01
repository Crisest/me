import { useState } from 'react';
import { ALL_ACCOUNTS_ID } from '@/hooks/useAccountFilter';
import { SORT_OPTIONS } from '@/components/TransactionsTable/SortDirectionFilter';
import type { SortDirection } from '@/components/TransactionsTable/TransactionsTable';
import type { Scope } from '@/components/ScopeToggle/ScopeToggle';
import YButton from '@ui/Button/Button';
import YmCombobox, { Option } from '@ui/YmCombobox/YmCombobox';
import YmDialog from '@ui/YmDialog/YmDialog';
import YmSegmented from '@ui/YmSegmented/YmSegmented';
import { countActiveFilters } from './activeFilters';
import styles from './TransactionFilterSheet.module.css';

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'household', label: 'Household' },
];

interface TransactionFilterSheetProps {
  resultCount: number;
  accountOptions: Option<string>[];
  selectedAccountId: string;
  onAccountChange: (id: string) => void;
  sortDirection: SortDirection;
  onSortChange: (value: SortDirection) => void;
  /** Omit for a solo household — the Mine/Household section is hidden. */
  scope?: Scope;
  onScopeChange?: (value: Scope) => void;
}

export function TransactionFilterSheet({
  resultCount,
  accountOptions,
  selectedAccountId,
  onAccountChange,
  sortDirection,
  onSortChange,
  scope,
  onScopeChange,
}: TransactionFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters({
    selectedAccountId,
    sortDirection,
    scope,
  });
  const sortLabel = SORT_OPTIONS.find(o => o.value === sortDirection)?.label;

  const reset = () => {
    onAccountChange(ALL_ACCOUNTS_ID);
    onSortChange('newest');
    onScopeChange?.('mine');
  };

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {resultCount} transactions · {sortLabel}
        </span>
        <YButton
          variant="secondary"
          badge={activeCount}
          aria-label={activeCount ? `Filter, ${activeCount} active` : 'Filter'}
          onClick={() => setOpen(true)}
        >
          Filter
        </YButton>
      </div>
      <YmDialog
        isOpen={open}
        variant="sheet"
        title="Filter & sort"
        footerButtonText={`Show ${resultCount} transactions`}
        onClose={() => setOpen(false)}
      >
        {activeCount > 0 && (
          <YButton variant="link" onClick={reset}>
            Reset
          </YButton>
        )}
        <section>
          <h3 className={styles.sectionLabel}>Sort by</h3>
          <YmSegmented
            fullWidth
            ariaLabel="Sort by"
            options={SORT_OPTIONS}
            value={sortDirection}
            onChange={onSortChange}
          />
        </section>
        <section>
          <h3 className={styles.sectionLabel}>Account</h3>
          <YmCombobox
            options={accountOptions}
            value={selectedAccountId}
            onChange={onAccountChange}
            placeholder="All accounts"
            ariaLabel="Account filter"
          />
        </section>
        {scope && onScopeChange && (
          <section>
            <h3 className={styles.sectionLabel}>Show</h3>
            <YmSegmented
              fullWidth
              ariaLabel="Transaction scope"
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={onScopeChange}
            />
          </section>
        )}
      </YmDialog>
    </>
  );
}
