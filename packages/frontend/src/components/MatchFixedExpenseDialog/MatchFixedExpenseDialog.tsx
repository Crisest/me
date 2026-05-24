import { useMemo, useState } from 'react';
import YmDialog from '@ui/YmDialog/YmDialog';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import { useGetBudgetQuery } from '@/services/budgetService';
import {
  useGetTransactionsQuery,
  useMatchTransactionFixedExpenseMutation,
} from '@/services/transactionService';
import type { Transaction } from '@portfolio/common';
import styles from './MatchFixedExpenseDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  month: number;
  year: number;
};

const MatchFixedExpenseDialog: React.FC<Props> = ({
  open,
  onClose,
  transaction,
  month,
  year,
}) => {
  const { data: budget } = useGetBudgetQuery();
  const { data: transactions } = useGetTransactionsQuery(
    { month, year },
    { skip: !open },
  );
  const [match, { isLoading }] = useMatchTransactionFixedExpenseMutation();
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const matchedIds = useMemo(() => {
    const set = new Set<string>();
    (transactions ?? []).forEach(t => {
      if (t.id !== transaction?.id && t.fixedExpenseId) {
        set.add(t.fixedExpenseId);
      }
    });
    return set;
  }, [transactions, transaction?.id]);

  const options = useMemo(
    () =>
      (budget?.fixedExpenses ?? [])
        .filter(e => !matchedIds.has(e.id))
        .map(e => ({
          id: e.id,
          label: `${e.name} — $${e.amount}`,
          value: e.id,
        })),
    [budget?.fixedExpenses, matchedIds],
  );

  const handleSave = async () => {
    if (!transaction || !selected) return;
    setError(null);
    try {
      await match({ id: transaction.id, fixedExpenseId: selected }).unwrap();
      onClose();
      setSelected('');
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setError(apiErr?.data?.message ?? 'Could not match transaction');
    }
  };

  const handleClose = () => {
    setSelected('');
    setError(null);
    onClose();
  };

  return (
    <YmDialog
      isOpen={open}
      onClose={handleClose}
      title="Match transaction"
      footerButtonText="Save"
      footerButtonAction={handleSave}
      footerButtonDisabled={!selected || isLoading}
    >
      <div className={styles.body}>
        {options.length === 0 ? (
          <div className={styles.empty}>
            {budget?.fixedExpenses.length
              ? 'Every fixed expense is already matched for this month.'
              : 'No fixed expenses defined yet. Set them up in your budget first.'}
          </div>
        ) : (
          <YmCombobox
            options={options}
            value={selected}
            onChange={setSelected}
            placeholder="Choose a fixed expense"
            ariaLabel="Fixed expense"
          />
        )}
        {error && <div className={styles.error}>{error}</div>}
      </div>
    </YmDialog>
  );
};

export default MatchFixedExpenseDialog;
