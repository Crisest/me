import styles from './ScopeToggle.module.css';

export type Scope = 'mine' | 'household';

interface ScopeToggleProps {
  value: Scope;
  onChange: (value: Scope) => void;
}

const OPTIONS: { value: Scope; label: string }[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'household', label: 'Household' },
];

export function ScopeToggle({ value, onChange }: ScopeToggleProps) {
  return (
    <div className={styles.toggle} role="group" aria-label="Transaction scope">
      {OPTIONS.map(option => (
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

export default ScopeToggle;
