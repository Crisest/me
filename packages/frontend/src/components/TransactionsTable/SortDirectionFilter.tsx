import YmCombobox, { Option } from '@ui/YmCombobox/YmCombobox';
import { SortDirection } from './TransactionsTable';

export const SORT_OPTIONS: Option<SortDirection>[] = [
  { id: 'newest', label: 'Newest first', value: 'newest' },
  { id: 'oldest', label: 'Oldest first', value: 'oldest' },
];

interface SortDirectionFilterProps {
  value: SortDirection;
  onChange: (value: SortDirection) => void;
}

export function SortDirectionFilter({
  value,
  onChange,
}: SortDirectionFilterProps) {
  return (
    <YmCombobox
      options={SORT_OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel="Sort transactions by date"
      variant="bare"
    />
  );
}
