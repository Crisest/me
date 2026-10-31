import React, { useState } from 'react';
import {
  IoChevronBack,
  IoChevronDown,
  IoChevronForward,
} from 'react-icons/io5';
import { months, years } from '@/constants/date';
import YmDialog from '../YmDialog/YmDialog';
import styles from './YmMonthPicker.module.css';

const MAX_YEAR = years[0].value;
const MIN_YEAR = years[years.length - 1].value;
const SHORT = months.map(m => m.label.slice(0, 3));

interface YmMonthPickerProps {
  /** 1–12 */
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}

const YmMonthPicker: React.FC<YmMonthPickerProps> = ({
  month,
  year,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={`Month: ${months[month - 1].label} ${year}`}
        onClick={() => {
          setViewYear(year);
          setOpen(true);
        }}
      >
        {SHORT[month - 1]} {year}
        <IoChevronDown aria-hidden />
      </button>

      <YmDialog
        isOpen={open}
        onClose={close}
        variant="sheet"
        title="Choose month"
      >
        <div className={styles.yearRow}>
          <button
            type="button"
            className={styles.yearArrow}
            aria-label="Previous year"
            disabled={viewYear <= MIN_YEAR}
            onClick={() => setViewYear(viewYear - 1)}
          >
            <IoChevronBack aria-hidden />
          </button>
          <span aria-live="polite" className={styles.year}>
            {viewYear}
          </span>
          <button
            type="button"
            className={styles.yearArrow}
            aria-label="Next year"
            disabled={viewYear >= MAX_YEAR}
            onClick={() => setViewYear(viewYear + 1)}
          >
            <IoChevronForward aria-hidden />
          </button>
        </div>

        <div className={styles.grid}>
          {SHORT.map((label, i) => {
            const active = i + 1 === month && viewYear === year;
            return (
              <button
                key={label}
                type="button"
                className={
                  active
                    ? `${styles.month} ${styles.monthActive}`
                    : styles.month
                }
                aria-label={`${months[i].label} ${viewYear}`}
                aria-pressed={active}
                onClick={() => {
                  onChange(i + 1, viewYear);
                  close();
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </YmDialog>
    </>
  );
};

export default YmMonthPicker;
