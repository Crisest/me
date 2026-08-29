import { useEffect, useState } from 'react';
import YmDialog from '@ui/YmDialog/YmDialog';
import YmFlex from '@ui/YmFlex/YmFlex';
import Textbox from '@ui/Textbox/Textbox';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import {
  useCreateBudgetCategoryMutation,
  useUpdateBudgetCategoryMutation,
  useDeleteBudgetCategoryMutation,
} from '@/services/budgetCategoryService';
import type { BudgetCategory, BudgetCategoryKind } from '@portfolio/common';
import styles from './CategoryModal.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  /** null = create a new category */
  category: BudgetCategory | null;
};

const KIND_OPTIONS = [
  { id: 'flexible', value: 'flexible', label: 'Flexible — an envelope you spend into' },
  { id: 'fixed', value: 'fixed', label: 'Fixed — one recurring charge per month' },
  { id: 'ignored', value: 'ignored', label: 'Ignored — card payments and transfers, not spending' },
];

const CategoryModal: React.FC<Props> = ({ open, onClose, category }) => {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<BudgetCategoryKind>('flexible');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [createCategory, { isLoading: creating }] = useCreateBudgetCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateBudgetCategoryMutation();
  const [deleteCategory, { isLoading: deleting }] = useDeleteBudgetCategoryMutation();

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setKind(category?.kind ?? 'flexible');
    setPlannedAmount(category ? String(category.plannedAmount) : '');
    setError(null);
  }, [open, category]);

  const needsAmount = kind !== 'ignored';
  const isBusy = creating || updating || deleting;
  const canSave =
    name.trim().length > 0 && (!needsAmount || Number(plannedAmount) > 0);

  const handleSave = async () => {
    setError(null);
    const payload = {
      name: name.trim(),
      kind,
      ...(needsAmount ? { plannedAmount: Number(plannedAmount) } : {}),
    };
    try {
      if (category) {
        await updateCategory({ id: category.id, payload }).unwrap();
      } else {
        await createCategory(payload).unwrap();
      }
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setError(apiErr?.data?.message ?? 'Could not save category');
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    setError(null);
    try {
      await deleteCategory(category.id).unwrap();
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setError(apiErr?.data?.message ?? 'Could not delete category');
    }
  };

  return (
    <YmDialog
      isOpen={open}
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      footerButtonText="Save"
      footerButtonAction={handleSave}
      footerButtonDisabled={!canSave || isBusy}
    >
      <YmFlex direction="column" gap={16}>
        <Textbox
          label="Name"
          fullWidth
          placeholder="Groceries"
          value={name}
          onChange={setName}
        />

        <YmCombobox
          options={KIND_OPTIONS}
          value={kind}
          onChange={value => setKind(value as BudgetCategoryKind)}
          placeholder="Choose a type"
          ariaLabel="Category type"
        />

        {needsAmount && (
          <Textbox
            type="number"
            label="Monthly target"
            fullWidth
            placeholder="600"
            value={plannedAmount}
            onChange={setPlannedAmount}
          />
        )}

        {kind === 'ignored' && (
          <p className={styles.hint}>
            Transactions in this category are excluded from spending entirely.
            Use it for credit-card payments and transfers between your own
            accounts.
          </p>
        )}

        {category && (
          <button
            type="button"
            className={styles.deleteButton}
            onClick={handleDelete}
            disabled={isBusy}
          >
            Delete category
          </button>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </YmFlex>
    </YmDialog>
  );
};

export default CategoryModal;
