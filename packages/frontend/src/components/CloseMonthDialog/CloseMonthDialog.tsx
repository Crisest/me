import React from 'react';
import type { BudgetSummary } from '@portfolio/common';
import YmDialog from '@ui/YmDialog/YmDialog';
import { formatCAD, formatMonthYear } from '@/utils/format';

interface CloseMonthDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  month: number;
  year: number;
  summary?: BudgetSummary;
  transactionCount: number;
  closing?: boolean;
}

/**
 * Confirms filing a month.
 *
 * The copy states that closing freezes the record and that later transactions
 * will not be absorbed. It does NOT offer or hint at reopening — nothing in
 * this release reopens a month.
 */
const CloseMonthDialog: React.FC<CloseMonthDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  month,
  year,
  summary,
  transactionCount,
  closing,
}) => (
  <YmDialog
    isOpen={open}
    onClose={onCancel}
    title={`Close ${formatMonthYear(month, year)}`}
    footerButtonText={closing ? 'Closing…' : 'Close the month'}
    footerButtonAction={onConfirm}
    footerButtonDisabled={closing}
  >
    <p>
      This files {formatMonthYear(month, year)} as a permanent record:{' '}
      {formatCAD(summary?.income ?? 0)} of income, {formatCAD(summary?.totalCost ?? 0)}{' '}
      of cost, and {transactionCount}{' '}
      {transactionCount === 1 ? 'transaction' : 'transactions'}.
    </p>
    <p>
      The numbers stop moving. Editing a category or a salary later will not
      change what this month says, and transactions that arrive afterwards are
      reported but not added to it.
    </p>
  </YmDialog>
);

export default CloseMonthDialog;
