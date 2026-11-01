import { describe, it, expect } from 'vitest';
import { ALL_ACCOUNTS_ID } from '@/hooks/useAccountFilter';
import { countActiveFilters } from './activeFilters';

const defaults = {
  selectedAccountId: ALL_ACCOUNTS_ID,
  sortDirection: 'newest' as const,
  scope: 'mine' as const,
};

describe('countActiveFilters', () => {
  it('is 0 when everything is default', () => {
    expect(countActiveFilters(defaults)).toBe(0);
  });

  it('counts a selected account', () => {
    expect(
      countActiveFilters({ ...defaults, selectedAccountId: 'acc-1' }),
    ).toBe(1);
  });

  it('counts a non-default sort', () => {
    expect(countActiveFilters({ ...defaults, sortDirection: 'oldest' })).toBe(
      1,
    );
  });

  it('counts household scope', () => {
    expect(countActiveFilters({ ...defaults, scope: 'household' })).toBe(1);
  });

  it('counts all three together', () => {
    expect(
      countActiveFilters({
        selectedAccountId: 'acc-1',
        sortDirection: 'oldest',
        scope: 'household',
      }),
    ).toBe(3);
  });

  it('does not count an undefined scope', () => {
    expect(countActiveFilters({ ...defaults, scope: undefined })).toBe(0);
  });
});
