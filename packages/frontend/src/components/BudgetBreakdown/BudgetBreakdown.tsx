import type { BudgetCategory } from '@portfolio/common';
import { formatCAD } from '@/utils/format';
import styles from './BudgetBreakdown.module.css';

interface BudgetBreakdownProps {
  categories: BudgetCategory[] | undefined;
  salary: number | undefined;
  title?: string;
}

export function BudgetBreakdown({
  categories,
  salary,
  title = 'Budget Breakdown',
}: BudgetBreakdownProps) {
  if (salary === undefined) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>{title}</div>
        <p className={styles.emptyMessage}>No budget set up yet.</p>
      </div>
    );
  }

  // `ignored` categories are not spending, so they never appear in a breakdown.
  const planned = (categories ?? []).filter(c => c.kind !== 'ignored');
  const totalPlanned = planned.reduce((sum, c) => sum + c.plannedAmount, 0);
  const remaining = salary - totalPlanned;

  return (
    <div className={styles.container}>
      <div className={styles.header}>{title}</div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Monthly Income</span>
        <span className={`${styles.rowAmount} ${styles.positive}`}>
          +{formatCAD(salary)}
        </span>
      </div>

      {planned.map(category => (
        <div className={styles.row} key={category.id}>
          <span className={styles.rowLabel}>{category.name}</span>
          <span className={`${styles.rowAmount} ${styles.negative}`}>
            -{formatCAD(category.plannedAmount)}
          </span>
        </div>
      ))}

      <hr className={styles.divider} />

      <div className={styles.totalRow}>
        <span>Remaining</span>
        <span className={remaining >= 0 ? styles.positive : styles.negative}>
          {formatCAD(remaining)}
        </span>
      </div>
    </div>
  );
}
