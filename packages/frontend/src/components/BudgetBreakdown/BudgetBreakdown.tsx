import type { Budget } from '@portfolio/common';
import { formatCAD } from '@/utils/format';
import styles from './BudgetBreakdown.module.css';

interface BudgetBreakdownProps {
  budget: Budget | null | undefined;
  title?: string;
}

export function BudgetBreakdown({ budget, title = 'Budget Breakdown' }: BudgetBreakdownProps) {
  if (!budget) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>{title}</div>
        <p className={styles.emptyMessage}>No budget set up yet.</p>
      </div>
    );
  }

  const totalFixed = budget.fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget.salary - totalFixed;

  return (
    <div className={styles.container}>
      <div className={styles.header}>{title}</div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Monthly Income</span>
        <span className={`${styles.rowAmount} ${styles.positive}`}>
          +{formatCAD(budget.salary)}
        </span>
      </div>

      {budget.fixedExpenses.map((expense, i) => (
        <div className={styles.row} key={i}>
          <span className={styles.rowLabel}>{expense.name}</span>
          <span className={`${styles.rowAmount} ${styles.negative}`}>
            -{formatCAD(expense.amount)}
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
