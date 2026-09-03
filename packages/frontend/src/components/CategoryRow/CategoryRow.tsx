import { useState } from 'react';
import { IoReceiptOutline } from 'react-icons/io5';
import Textbox from '@ui/Textbox/Textbox';
import YButton from '@ui/Button/Button';
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
  /** Optional so the row still compiles where the drilldown isn't wired. */
  onViewTransactions?: (categoryId: string) => void;
};

const CategoryRow: React.FC<Props> = ({
  summary,
  month,
  year,
  onEdit,
  onViewTransactions,
}) => {
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
        <span className={styles.nameGroup}>
          <button
            type="button"
            className={styles.name}
            onClick={() => onEdit(summary.categoryId)}
          >
            {summary.name}
          </button>

          {onViewTransactions && (
            <YButton
              variant="styleless"
              customClass={styles.drilldown}
              aria-label={`View ${summary.name} transactions`}
              title={`View ${summary.name} transactions`}
              onClick={() => onViewTransactions(summary.categoryId)}
            >
              <IoReceiptOutline />
            </YButton>
          )}
        </span>

        {isIgnored ? (
          <span className={styles.amounts}>
            {formatCAD(summary.actual)} · excluded
          </span>
        ) : editingTarget ? (
          <span className={styles.editor}>
            <Textbox
              type="number"
              customClass={styles.input}
              value={draft}
              onChange={setDraft}
              aria-label={`Monthly target for ${summary.name}`}
            />
            <YButton
              variant="primary"
              customClass={styles.editorButton}
              onClick={saveTarget}
            >
              Save
            </YButton>
            {summary.isOverridden && (
              <YButton
                variant="secondary"
                customClass={styles.editorButton}
                onClick={resetTarget}
              >
                Reset
              </YButton>
            )}
            <YButton variant="link" onClick={() => setEditingTarget(false)}>
              Cancel
            </YButton>
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
