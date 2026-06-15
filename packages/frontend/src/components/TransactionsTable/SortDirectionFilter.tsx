import YmCombobox, { Option } from '@ui/YmCombobox/YmCombobox';
import { SortDirection } from './TransactionsTable';

const options: Option<SortDirection>[] = [
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
      options={options}
      value={value}
      onChange={onChange}
      ariaLabel="Sort transactions by date"
    />
  );
}
