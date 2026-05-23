import { IoTrashOutline, IoPencilOutline } from 'react-icons/io5';
import { formatCAD } from '@/utils/format';
import styles from '../BudgetModal.module.css';
import type { FixedExpenseInput } from '../types';

type DisplayExpenseRowProps = {
  expense: FixedExpenseInput;
  onEdit: () => void;
  onRemove: () => void;
};

const DisplayExpenseRow: React.FC<DisplayExpenseRowProps> = ({
  expense,
  onEdit,
  onRemove,
}) => (
  <div className={styles.row}>
    <span className={styles.rowLabel}>{expense.name}</span>
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
