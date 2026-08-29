import { useState } from 'react';
import { formatCAD } from '@/utils/format';
import {
  useSetCategoryOverrideMutation,
  useClearCategoryOverrideMutation,
} from '@/services/budgetCategoryService';
import type { BudgetCategorySummary } from '@portfolio/common';
import styles from './CategoryRow.module.css';

type Props = {
  summary: BudgetCategorySummary;
  month: number;
  year: number;
  onEdit: (categoryId: string) => void;
};

const CategoryRow: React.FC<Props> = ({ summary, month, year, onEdit }) => {
  const [editingTarget, setEditingTarget] = useState(false);
  const [draft, setDraft] = useState('');
  const [setOverride] = useSetCategoryOverrideMutation();
  const [clearOverride] = useClearCategoryOverrideMutation();

  const isIgnored = summary.kind === 'ignored';
  const isOver = !isIgnored && summary.actual > summary.planned;
  const percent =
    summary.planned > 0
      ? Math.min(100, Math.round((summary.actual / summary.planned) * 100))
      : 0;

  const startEditing = () => {
    setDraft(String(summary.planned));
    setEditingTarget(true);
  };

  const saveTarget = async () => {
    const value = Number(draft);
    if (value > 0) {
      await setOverride({
        id: summary.categoryId,
        payload: { month, year, plannedAmount: value },
      });
    }
    setEditingTarget(false);
  };

  const resetTarget = async () => {
    await clearOverride({ id: summary.categoryId, month, year });
    setEditingTarget(false);
  };

  return (
    <div className={styles.row}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.name}
          onClick={() => onEdit(summary.categoryId)}
        >
          {summary.name}
        </button>

        {isIgnored ? (
          <span className={styles.amounts}>
            {formatCAD(summary.actual)} · excluded
          </span>
        ) : editingTarget ? (
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
            className={`${styles.amounts} ${isOver ? styles.over : ''}`}
            onClick={startEditing}
            title="Set a target just for this month"
          >
            {formatCAD(summary.actual)} / {formatCAD(summary.planned)}
            {summary.isOverridden && <span className={styles.badge}>custom</span>}
          </button>
        )}
      </div>

      {!isIgnored && (
        <div className={styles.track}>
          <div
            className={`${styles.fill} ${isOver ? styles.fillOver : ''}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className={styles.meta}>
        {summary.transactionCount}{' '}
        {summary.transactionCount === 1 ? 'transaction' : 'transactions'}
        {isOver && ` · over by ${formatCAD(summary.actual - summary.planned)}`}
      </div>
    </div>
  );
};

export default CategoryRow;
