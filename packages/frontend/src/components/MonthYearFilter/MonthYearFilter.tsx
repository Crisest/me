import { ReactNode } from 'react';
import YmFlex from '@ui/YmFlex/YmFlex';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import { months, years } from '@/constants/date';

interface MonthYearFilterProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  children?: ReactNode;
}

export function MonthYearFilter({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  children,
}: MonthYearFilterProps) {
  // Wraps because this now shares a line with the page title inside
  // PageHeader — the transactions page passes six controls through here,
  // and YmFlex is nowrap by default.
  return (
    <YmFlex justify="end" align="center" gap={15} wrap="wrap">
      <YmCombobox
        options={months}
        value={selectedMonth}
        onChange={onMonthChange}
        placeholder="Select a month"
        ariaLabel="Month filter"
        variant="bare"
      />
      <YmCombobox
        options={years}
        value={selectedYear}
        onChange={onYearChange}
        placeholder="Select a year"
        ariaLabel="Year filter"
        variant="bare"
      />
      {children}
    </YmFlex>
  );
}
