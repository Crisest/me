import { useEffect, useMemo, useRef, useState } from 'react';
import { IoAdd } from 'react-icons/io5';
import YmFlex from '@ui/YmFlex/YmFlex';
import Textbox from '@ui/Textbox/Textbox';
import YmDialog from '@ui/YmDialog/YmDialog';
import { formatCAD } from '@/utils/format';
import {
  useGetBudgetQuery,
  useUpsertBudgetMutation,
} from '@/services/budgetService';
import type { Transaction } from '@portfolio/common';
import styles from './BudgetModal.module.css';
import DisplayExpenseRow from './components/DisplayExpenseRow';
import EditExpenseRow from './components/EditExpenseRow';
import type { Draft, FixedExpenseInput } from './types';

type BudgetModalProps = {
  openModal: boolean;
  setOpenModal: (open: boolean) => void;
  transactions: Transaction[];
};

const isObjectId = (s: string): boolean => /^[a-f0-9]{24}$/.test(s);

// crypto.randomUUID() is only available in secure contexts (HTTPS/localhost),
// so it throws when the app is served over plain HTTP on the LAN. These ids are
// throwaway client-side keys (real ids come from the backend on save), so a
// simple non-crypto temp id is sufficient — and the `temp-` prefix never
// matches isObjectId, keeping new rows correctly treated as new.
const tempId = (): string =>
  `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const BudgetModal: React.FC<BudgetModalProps> = ({
  openModal,
  setOpenModal,
  transactions,
}) => {
  const [salary, setSalary] = useState('');
  const [expenses, setExpenses] = useState<FixedExpenseInput[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', amount: '' });
  const [newRowId, setNewRowId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { data: budget } = useGetBudgetQuery();
  const [upsertBudget, { isLoading }] = useUpsertBudgetMutation();

  const matchByFixedId = useMemo(() => {
    const map = new Map<string, { description: string }>();
    transactions.forEach(t => {
      if (t.fixedExpenseId) {
        map.set(t.fixedExpenseId, { description: t.description });
      }
    });
    return map;
  }, [transactions]);

  useEffect(() => {
    if (openModal && budget) {
      setSalary(String(budget.salary));
      setExpenses(
        budget.fixedExpenses.map(e => ({
          id: e.id,
          name: e.name,
          amount: String(e.amount),
        })),
      );
      setEditingId(null);
      setNewRowId(null);
      setMutationError(null);
    }
  }, [openModal, budget]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses],
  );
  const remaining = (Number(salary) || 0) - totalExpenses;

  const startEdit = (expense: FixedExpenseInput) => {
    setEditingId(expense.id);
    setDraft({ name: expense.name, amount: expense.amount });
  };

  const cancelEdit = () => {
    if (newRowId && editingId === newRowId) {
      setExpenses(expenses.filter(e => e.id !== newRowId));
      setNewRowId(null);
    }
    setEditingId(null);
    setDraft({ name: '', amount: '' });
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (!draft.name.trim() || !draft.amount) return;
    setExpenses(
      expenses.map(e =>
        e.id === editingId
          ? { ...e, name: draft.name.trim(), amount: draft.amount }
          : e,
      ),
    );
    setNewRowId(null);
    setEditingId(null);
    setDraft({ name: '', amount: '' });
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
    if (editingId === id) cancelEdit();
  };

  const addExpense = () => {
    if (editingId) return;
    const id = tempId();
    setExpenses([...expenses, { id, name: '', amount: '' }]);
    setEditingId(id);
    setNewRowId(id);
    setDraft({ name: '', amount: '' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMutationError(null);

    const finalExpenses = expenses.filter(
      ex => ex.id !== newRowId && ex.name.trim() && ex.amount,
    );

    try {
      await upsertBudget({
        salary: Number(salary),
        fixedExpenses: finalExpenses.map(e => ({
          ...(isObjectId(e.id) ? { id: e.id } : {}),
          name: e.name,
          amount: Number(e.amount),
        })),
      }).unwrap();
      setOpenModal(false);
    } catch {
      setMutationError('Failed to save budget. Please try again.');
    }
  };

  const submit = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <YmDialog
      title="Set up your budget"
      isOpen={openModal}
      onClose={() => setOpenModal(false)}
      footerButtonAction={submit}
      footerButtonText="Save"
      footerButtonDisabled={isLoading}
    >
      <form onSubmit={handleSubmit} ref={formRef}>
        <YmFlex direction="column" gap={24}>
          <div className={styles.section}>
            <Textbox
              type="number"
              label="Monthly salary"
              fullWidth
              placeholder="Enter your monthly salary"
              value={salary}
              onChange={setSalary}
            />
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Fixed expenses</h3>
              <span className={styles.sectionCount}>
                {expenses.length} {expenses.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {expenses.length === 0 ? (
              <p className={styles.emptyMessage}>No fixed expenses yet.</p>
            ) : (
              <div className={styles.list}>
                {expenses.map(expense =>
                  editingId === expense.id ? (
                    <EditExpenseRow
                      key={expense.id}
                      draft={draft}
                      onChange={setDraft}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <DisplayExpenseRow
                      key={expense.id}
                      expense={expense}
                      onEdit={() => startEdit(expense)}
                      onRemove={() => removeExpense(expense.id)}
                      matchedTxn={matchByFixedId.get(expense.id) ?? null}
                    />
                  ),
                )}
              </div>
            )}

            {!editingId && (
              <button
                type="button"
                onClick={addExpense}
                className={styles.addButton}
              >
                <IoAdd size={16} />
                Add expense
              </button>
            )}
          </div>

          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>Salary</span>
              <span>{formatCAD(Number(salary) || 0)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Fixed expenses</span>
              <span>-{formatCAD(totalExpenses)}</span>
            </div>
            <div
              className={`${styles.summaryRow} ${styles.summaryTotal} ${
                remaining < 0 ? styles.summaryTotalNegative : ''
              }`}
            >
              <span>Remaining</span>
              <span>{formatCAD(remaining)}</span>
            </div>
          </div>

          {mutationError && <p className={styles.error}>{mutationError}</p>}
        </YmFlex>
      </form>
    </YmDialog>
  );
};

export default BudgetModal;
