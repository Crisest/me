import { IoTrashOutline, IoPencilOutline } from 'react-icons/io5';
import { formatCAD } from '@/utils/format';
import styles from '../BudgetModal.module.css';
import type { FixedExpenseInput } from '../types';

type DisplayExpenseRowProps = {
  expense: FixedExpenseInput;
  onEdit: () => void;
  onRemove: () => void;
  matchedTxn: { description: string } | null;
};

const DisplayExpenseRow: React.FC<DisplayExpenseRowProps> = ({
  expense,
  onEdit,
  onRemove,
  matchedTxn,
}) => (
  <div className={styles.row}>
    <div className={styles.rowLabelGroup}>
      <span className={styles.rowLabel}>{expense.name}</span>
      {matchedTxn ? (
        <span className={styles.matchStatus}>
          ● Paid · {matchedTxn.description}
        </span>
      ) : (
        <span className={`${styles.matchStatus} ${styles.matchStatusUnmatched}`}>
          ○ Not matched
        </span>
      )}
    </div>
    <span className={styles.rowAmount}>
      -{formatCAD(Number(expense.amount) || 0)}
    </span>
    <button
      type="button"
      onClick={onEdit}
      className={styles.iconButton}
      aria-label="Edit expense"
    >
      <IoPencilOutline size={16} />
    </button>
    <button
      type="button"
      onClick={onRemove}
      className={`${styles.iconButton} ${styles.iconButtonDanger}`}
      aria-label="Remove expense"
    >
      <IoTrashOutline size={16} />
    </button>
  </div>
);

export default DisplayExpenseRow;
