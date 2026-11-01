import styles from './YmSegmented.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface YmSegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Stretch to the container width with equal-width segments. */
  fullWidth?: boolean;
}

export default function YmSegmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = false,
}: YmSegmentedProps<T>) {
  return (
    <div
      className={fullWidth ? `${styles.group} ${styles.fullWidth}` : styles.group}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={
            option.value === value
              ? `${styles.option} ${styles.optionActive}`
              : styles.option
          }
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
