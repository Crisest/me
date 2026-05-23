import { IoCheckmark, IoClose } from 'react-icons/io5';
import Textbox from '@ui/Textbox/Textbox';
import styles from '../BudgetModal.module.css';
import type { Draft } from '../types';

type EditExpenseRowProps = {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
};

const EditExpenseRow: React.FC<EditExpenseRowProps> = ({
  draft,
  onChange,
  onSave,
  onCancel,
}) => (
  <div className={`${styles.row} ${styles.rowEditing}`}>
    <Textbox
      placeholder="Expense name"
      value={draft.name}
      onChange={value => onChange({ ...draft, name: value })}
      customClass={styles.editName}
      aria-label="expense name"
      autoFocus
    />
    <Textbox
      type="number"
      placeholder="0"
      value={draft.amount}
      onChange={value => onChange({ ...draft, amount: value })}
      customClass={styles.editAmount}
      aria-label="expense amount"
    />
    <button
      type="button"
      onClick={onSave}
      className={styles.iconButton}
      aria-label="Save expense"
    >
      <IoCheckmark size={18} />
    </button>
    <button
      type="button"
      onClick={onCancel}
      className={`${styles.iconButton} ${styles.iconButtonDanger}`}
      aria-label="Cancel edit"
    >
      <IoClose size={18} />
    </button>
  </div>
);

export default EditExpenseRow;
