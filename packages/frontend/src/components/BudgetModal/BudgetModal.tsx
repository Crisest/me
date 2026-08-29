import { useEffect, useRef, useState } from 'react';
import YmFlex from '@ui/YmFlex/YmFlex';
import Textbox from '@ui/Textbox/Textbox';
import YmDialog from '@ui/YmDialog/YmDialog';
import {
  useGetBudgetQuery,
  useUpsertBudgetMutation,
} from '@/services/budgetService';
import styles from './BudgetModal.module.css';

type BudgetModalProps = {
  openModal: boolean;
  setOpenModal: (open: boolean) => void;
};

const BudgetModal: React.FC<BudgetModalProps> = ({ openModal, setOpenModal }) => {
  const [salary, setSalary] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { data: budget } = useGetBudgetQuery();
  const [upsertBudget, { isLoading }] = useUpsertBudgetMutation();

  useEffect(() => {
    if (openModal && budget) {
      setSalary(String(budget.salary));
      setMutationError(null);
    }
  }, [openModal, budget]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMutationError(null);
    try {
      await upsertBudget({ salary: Number(salary) }).unwrap();
      setOpenModal(false);
    } catch {
      setMutationError('Failed to save budget. Please try again.');
    }
  };

  return (
    <YmDialog
      title="Monthly income"
      isOpen={openModal}
      onClose={() => setOpenModal(false)}
      footerButtonAction={() => formRef.current?.requestSubmit()}
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
            <p className={styles.hint}>
              Spending targets live on the Budget page as categories.
            </p>
          </div>
          {mutationError && <p className={styles.error}>{mutationError}</p>}
        </YmFlex>
      </form>
    </YmDialog>
  );
};

export default BudgetModal;
