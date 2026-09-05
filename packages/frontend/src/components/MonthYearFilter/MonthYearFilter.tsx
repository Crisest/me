import { ReactNode } from 'react';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import { months, years } from '@/constants/date';
import styles from './MonthYearFilter.module.css';

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
    <div className={styles.filter}>
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
    </div>
  );
}
