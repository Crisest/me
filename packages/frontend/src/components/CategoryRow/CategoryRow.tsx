import { useState } from 'react';
import Textbox from '@ui/Textbox/Textbox';
import YButton from '@ui/Button/Button';
import { formatCAD } from '@/utils/format';
import { pressureTone, pressurePercent } from '@/utils/budgetPressure';
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
  const tone = isIgnored ? 'ok' : pressureTone(summary.actual, summary.planned);
  const percent = pressurePercent(summary.actual, summary.planned);
  // Nothing tagged means nothing to say — the row recedes and offers no link.
  const isEmpty = summary.transactionCount === 0;

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
    <div className={`${styles.row} ${isEmpty ? styles.empty : ''}`}>
      <div className={styles.header}>
        <span className={styles.nameGroup}>
          <button
            type="button"
            className={styles.name}
            onClick={() => onEdit(summary.categoryId)}
          >
            {summary.name}
          </button>

          {summary.isOverridden && <span className={styles.badge}>custom</span>}

          {onViewTransactions && !isEmpty && (
            <button
              type="button"
              className={styles.count}
              // The visible text is the accessible name — an aria-label naming
              // the category would replace "1 transaction" rather than extend
              // it. The tooltip carries the category for sighted hover instead.
              title={`View ${summary.name} transactions`}
              onClick={() => onViewTransactions(summary.categoryId)}
            >
              {summary.transactionCount}{' '}
              {summary.transactionCount === 1 ? 'transaction' : 'transactions'}
            </button>
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
            className={`${styles.amounts} ${styles[tone]}`}
            onClick={startEditing}
            title="Set a target just for this month"
          >
            <strong className={styles.actual}>
              {formatCAD(summary.actual)}
            </strong>{' '}
            <span className={styles.planned}>
              / {formatCAD(summary.planned)}
            </span>
          </button>
        )}
      </div>

      {!isIgnored && (
        <div className={styles.track}>
          <div
            className={`${styles.fill} ${styles[tone]}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default CategoryRow;
