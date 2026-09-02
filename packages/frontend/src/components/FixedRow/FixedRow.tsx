import { useState } from 'react';
import { IoCheckmarkCircle, IoEllipseOutline, IoReceiptOutline } from 'react-icons/io5';
import Textbox from '@ui/Textbox/Textbox';
import YButton from '@ui/Button/Button';
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
  /** Optional so the row still compiles where the drilldown isn't wired. */
  onViewTransactions?: (categoryId: string) => void;
};

const FixedRow: React.FC<Props> = ({
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
    </div>
  );
};

export default FixedRow;
