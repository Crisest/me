import { useState } from 'react';
import { IoCheckmarkCircle, IoEllipseOutline } from 'react-icons/io5';
import { formatCAD } from '@/utils/format';
import {
  useSetCategoryOverrideMutation,
  useClearCategoryOverrideMutation,
} from '@/services/budgetCategoryService';
import type { BudgetCategorySummary } from '@portfolio/common';
import styles from './FixedRow.module.css';

type Props = {
  summary: BudgetCategorySummary;
  month: number;
  year: number;
  onEdit: (categoryId: string) => void;
};

const FixedRow: React.FC<Props> = ({ summary, month, year, onEdit }) => {
  const [editingTarget, setEditingTarget] = useState(false);
  const [draft, setDraft] = useState('');
  const [setOverride] = useSetCategoryOverrideMutation();
  const [clearOverride] = useClearCategoryOverrideMutation();

  // A fixed bill is "paid" once anything is tagged to it this month. The
  // amount that landed is the interesting part, so it wins the row when it
  // differs from what was planned.
  const isPaid = summary.transactionCount > 0;
  const delta = summary.actual - summary.planned;
  const hasDelta = isPaid && Math.abs(delta) >= 0.01;

  const startEditing = (): void => {
    setDraft(String(summary.planned));
    setEditingTarget(true);
  };

  const saveTarget = async (): Promise<void> => {
    const value = Number(draft);
    if (value > 0) {
      await setOverride({
        id: summary.categoryId,
        payload: { month, year, plannedAmount: value },
      });
    }
    setEditingTarget(false);
  };

  const resetTarget = async (): Promise<void> => {
    await clearOverride({ id: summary.categoryId, month, year });
    setEditingTarget(false);
  };

  return (
    <div className={`${styles.row} ${isPaid ? '' : styles.pending}`}>
      <span
        className={`${styles.marker} ${isPaid ? styles.paid : ''}`}
        role="img"
        aria-label={isPaid ? 'Tagged this month' : 'Not tagged yet'}
      >
        {isPaid ? <IoCheckmarkCircle /> : <IoEllipseOutline />}
      </span>

      <button
        type="button"
        className={styles.name}
        onClick={() => onEdit(summary.categoryId)}
      >
        {summary.name}
      </button>

      {editingTarget ? (
        <span className={styles.editor}>
          <input
            className={styles.input}
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            aria-label={`Monthly target for ${summary.name}`}
          />
          <button type="button" onClick={saveTarget}>Save</button>
          {summary.isOverridden && (
            <button type="button" onClick={resetTarget}>Reset</button>
          )}
          <button type="button" onClick={() => setEditingTarget(false)}>Cancel</button>
        </span>
      ) : (
        <button
          type="button"
          className={styles.amounts}
          onClick={startEditing}
          title="Set a target just for this month"
        >
          {formatCAD(isPaid ? summary.actual : summary.planned)}
          {summary.isOverridden && <span className={styles.badge}>custom</span>}
          {hasDelta && (
            <span className={delta > 0 ? styles.over : styles.under}>
              {delta > 0 ? '+' : '−'}
              {formatCAD(Math.abs(delta))} vs plan
            </span>
          )}
        </button>
      )}
    </div>
  );
};

export default FixedRow;
