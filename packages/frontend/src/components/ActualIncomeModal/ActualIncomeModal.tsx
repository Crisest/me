import { useEffect, useRef, useState } from 'react';
import YmFlex from '@ui/YmFlex/YmFlex';
import Textbox from '@ui/Textbox/Textbox';
import YmDialog from '@ui/YmDialog/YmDialog';
import {
  useGetBudgetOverrideQuery,
  useUpsertBudgetOverrideMutation,
} from '@/services/budgetService';

type Props = {
  openModal: boolean;
  setOpenModal: (open: boolean) => void;
  month: number;
  year: number;
  projectedSalary: number;
};

const ActualIncomeModal: React.FC<Props> = ({
  openModal,
  setOpenModal,
  month,
  year,
  projectedSalary,
}) => {
  const [salary, setSalary] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { data } = useGetBudgetOverrideQuery({ month, year });
  const [upsertBudgetOverride, { isLoading }] = useUpsertBudgetOverrideMutation();

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-US', {
    month: 'long',
  });

  useEffect(() => {
    if (openModal) {
      setSalary(data ? String(data.salary) : String(projectedSalary));
    }
  }, [openModal, data, projectedSalary]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMutationError(null);

    try {
      await upsertBudgetOverride({ month, year, salary: Number(salary) }).unwrap();
      setOpenModal(false);
    } catch {
      setMutationError('Failed to save actual income. Please try again.');
    }
  };

  const submit = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <YmDialog
      title="Set actual income"
      isOpen={openModal}
      onClose={() => setOpenModal(false)}
      footerButtonAction={submit}
      footerButtonText="Save"
      footerButtonDisabled={isLoading}
    >
      <form onSubmit={handleSubmit} ref={formRef}>
        <YmFlex direction="column" gap={20}>
          <p style={{ margin: 0 }}>
            Actual income for {monthLabel} {year}
          </p>

          <Textbox
            type="number"
            aria-label="actual salary input"
            fullWidth
            value={salary}
            onChange={setSalary}
          />

          {mutationError && (
            <p style={{ color: 'red', margin: 0 }}>{mutationError}</p>
          )}
        </YmFlex>
      </form>
    </YmDialog>
  );
};

export default ActualIncomeModal;
