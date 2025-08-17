import { useState } from 'react';
import YmCombobox from '../../YmCombobox/YmCombobox';
import type { Option } from '../../YmCombobox/YmCombobox';

const months: Option[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((month, index) => ({
  id: index,
  label: month,
  value: index + 1,
}));

const MonthSelect = () => {
  const previousMonth = new Date().getMonth() - 1; // Get current month (0-11)
  const [selectedMonth, setSelectedMonth] = useState<number>(previousMonth + 1);

  return (
    <YmCombobox
      options={months}
      value={selectedMonth}
      onChange={value => setSelectedMonth(value)}
      placeholder="Select a month"
      ariaLabel="Month filter"
    />
  );
};

export default MonthSelect;

// todo: move the combobox to its own component
// make sure the inpuyt doesnt go further than the width
