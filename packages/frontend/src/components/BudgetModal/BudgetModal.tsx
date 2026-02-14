import { useRef, useState } from 'react';
import YButtom from '../Button/Button';
import YmFlex from '../Layout/YmFlex/YmFlex/YmFlex';
import Textbox from '../Textbox/Textbox';
import YmDialog from '../YmDialog/YmDialog';

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
  const [expenses, setExpenses] = useState<FixedExpenseInput[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const salary = Number(formData.get('salary'));

    const payload = {
      salary,
      fixedExpenses: expenses.map(e => ({
        name: e.name,
        amount: Number(e.amount),
      })),
    };

    console.log(payload);
    // call API to update budget
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
    >
      <form onSubmit={handleSubmit} ref={formRef}>
        <YmFlex direction="column" gap={20}>
          <Textbox
            type="number"
            name="salary"
            aria-label="salary input"
            fullWidth
            placeholder="Enter your monthly salary"
          />

          {expenses.map(expense => (
            <FixedExpenseItem
              key={expense.id}
              expense={expense}
              onUpdate={updateExpense}
              onRemove={removeExpense}
            />
          ))}

          <YButtom type="button" onClick={addExpense} variant="primary">
            + Add fixed expense
          </YButtom>
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
      <YButtom
        type="button"
        onClick={() => onRemove(expense.id)}
        variant="secondary"
      >
        Remove
      </YButtom>
    </YmFlex>
  );
};

export default BudgetModal;
