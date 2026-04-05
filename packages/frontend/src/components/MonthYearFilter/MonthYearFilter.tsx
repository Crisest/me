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
  return (
    <YmFlex justify="end" align="center" gap={30}>
      <YmCombobox
        options={months}
        value={selectedMonth}
        onChange={onMonthChange}
        placeholder="Select a month"
        ariaLabel="Month filter"
      />
      <YmCombobox
        options={years}
        value={selectedYear}
        onChange={onYearChange}
        placeholder="Select a year"
        ariaLabel="Year filter"
      />
      {children}
    </YmFlex>
  );
}
