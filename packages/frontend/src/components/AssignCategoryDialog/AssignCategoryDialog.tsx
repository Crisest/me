import { useEffect, useMemo, useState } from 'react';
import YmDialog from '@ui/YmDialog/YmDialog';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import { useGetBudgetCategoriesQuery } from '@/services/budgetCategoryService';
import {
  useGetTransactionsQuery,
  useSetTransactionCategoryMutation,
} from '@/services/transactionService';
import type { BudgetCategory, Transaction } from '@portfolio/common';
import styles from './AssignCategoryDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  month: number;
  year: number;
};

/**
 * Plaid personal-finance-category primaries that mean "this is not spending".
 * Used only to pre-select the user's ignored category — never stored.
 * Exported because Task 15's overview page uses it to decide whether to offer
 * a transfers category.
 */
export const TRANSFER_PRIMARIES = ['LOAN_PAYMENTS', 'TRANSFER_OUT'];

const isLikelyTransfer = (txn: Transaction | null): boolean =>
  !!txn?.category && TRANSFER_PRIMARIES.includes(txn.category);

const AssignCategoryDialog: React.FC<Props> = ({
  open,
  onClose,
  transaction,
  month,
  year,
}) => {
  const { data: categories } = useGetBudgetCategoriesQuery();
  const { data: transactions } = useGetTransactionsQuery(
    { month, year },
    { skip: !open },
  );
  const [assign, { isLoading }] = useSetTransactionCategoryMutation();
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Only `fixed` categories are exclusive; a month may hold just one
  // transaction each. Flexible and ignored categories are always available.
  const claimedIds = useMemo(() => {
    const set = new Set<string>();
    (transactions ?? []).forEach(t => {
      if (t.id !== transaction?.id && t.categoryId) set.add(t.categoryId);
    });
    return set;
  }, [transactions, transaction?.id]);

  const available = useMemo<BudgetCategory[]>(
    () =>
      (categories ?? []).filter(
        c => c.kind !== 'fixed' || !claimedIds.has(c.id),
      ),
    [categories, claimedIds],
  );

  // Pre-select the ignored category when Plaid says this is a payment/transfer.
  useEffect(() => {
    if (!open) return;
    if (!isLikelyTransfer(transaction)) return;
    const ignored = available.find(c => c.kind === 'ignored');
    if (ignored) setSelected(ignored.id);
  }, [open, transaction, available]);

  const options = useMemo(
    () =>
      available.map(c => ({
        id: c.id,
        label:
          c.kind === 'ignored'
            ? `${c.name} — not spending`
            : `${c.name} — $${c.plannedAmount}`,
        value: c.id,
      })),
    [available],
  );

  const handleSave = async () => {
    if (!transaction || !selected) return;
    setError(null);
    try {
      await assign({ id: transaction.id, categoryId: selected }).unwrap();
      onClose();
      setSelected('');
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setError(apiErr?.data?.message ?? 'Could not assign transaction');
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
      title="Assign to category"
      footerButtonText="Save"
      footerButtonAction={handleSave}
      footerButtonDisabled={!selected || isLoading}
    >
      <div className={styles.body}>
        {options.length === 0 ? (
          <div className={styles.empty}>
            {categories?.length
              ? 'Every fixed category is already matched for this month.'
              : 'No categories yet. Create one on the Budget page first.'}
          </div>
        ) : (
          <YmCombobox
            options={options}
            value={selected}
            onChange={setSelected}
            placeholder="Choose a category"
            ariaLabel="Budget category"
          />
        )}
        {error && <div className={styles.error}>{error}</div>}
      </div>
    </YmDialog>
  );
};

export default AssignCategoryDialog;
