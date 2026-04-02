import { useEffect, useRef, useState } from 'react';
import YButton from '@ui/Button/Button';
import YmFlex from '@ui/YmFlex/YmFlex';
import Textbox from '@ui/Textbox/Textbox';
import YmDialog from '@ui/YmDialog/YmDialog';
import { useGetBudgetQuery, useUpsertBudgetMutation } from '@/services/budgetService';

type BudgetModalProps = {
  openModal: boolean;
  setOpenModal: (open: boolean) => void;
};

type FixedExpenseInput = {
  id: string;
  name: string;
  amount: string;
};

const BudgetModal: React.FC<BudgetModalProps> = ({
  openModal,
  setOpenModal,
}) => {
  const [salary, setSalary] = useState('');
  const [expenses, setExpenses] = useState<FixedExpenseInput[]>([]);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { data: budget } = useGetBudgetQuery();
  const [upsertBudget, { isLoading }] = useUpsertBudgetMutation();

  useEffect(() => {
    if (openModal && budget) {
      setSalary(String(budget.salary));
      setExpenses(
        budget.fixedExpenses.map(e => ({
          id: crypto.randomUUID(),
          name: e.name,
          amount: String(e.amount),
        }))
      );
    }
  }, [openModal, budget]);

  const addExpense = () => {
    setExpenses([
      ...expenses,
      { id: crypto.randomUUID(), name: '', amount: '' },
    ]);
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const updateExpense = (
    id: string,
    field: 'name' | 'amount',
    value: string,
  ) => {
    setExpenses(
      expenses.map(e => (e.id === id ? { ...e, [field]: value } : e)),
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMutationError(null);

    try {
      await upsertBudget({
        salary: Number(salary),
        fixedExpenses: expenses.map(e => ({
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
        <YmFlex direction="column" gap={20}>
          <Textbox
            type="number"
            aria-label="salary input"
            fullWidth
            placeholder="Enter your monthly salary"
            value={salary}
            onChange={setSalary}
          />

          {expenses.map(expense => (
            <FixedExpenseItem
              key={expense.id}
              expense={expense}
              onUpdate={updateExpense}
              onRemove={removeExpense}
            />
          ))}

          <YButton type="button" onClick={addExpense} variant="primary">
            + Add fixed expense
          </YButton>

          {mutationError && (
            <p style={{ color: 'red', margin: 0 }}>{mutationError}</p>
          )}
        </YmFlex>
      </form>
    </YmDialog>
  );
};

type FixedExpenseItemProps = {
  expense: FixedExpenseInput;
  onUpdate: (id: string, field: 'name' | 'amount', value: string) => void;
  onRemove: (id: string) => void;
};

const FixedExpenseItem: React.FC<FixedExpenseItemProps> = ({
  expense,
  onUpdate,
  onRemove,
}) => {
  return (
    <YmFlex gap={10} align="center">
      <Textbox
        placeholder="Expense name"
        value={expense.name}
        onChange={value => onUpdate(expense.id, 'name', value)}
        fullWidth
        aria-label="expense name"
      />
      <Textbox
        type="number"
        placeholder="Amount"
        value={expense.amount}
        onChange={value => onUpdate(expense.id, 'amount', value)}
        fullWidth
        aria-label="expense amount"
      />
      <YButton
        type="button"
        onClick={() => onRemove(expense.id)}
        variant="secondary"
      >
        Remove
      </YButton>
    </YmFlex>
  );
};

export default BudgetModal;
