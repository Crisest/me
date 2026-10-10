import React from 'react';
import type { MonthCloseState } from '@portfolio/common';
import YButton from '@ui/Button/Button';
import { formatMonthYear } from '@/utils/format';
import styles from './MonthCloseCard.module.css';

interface MonthCloseCardProps {
  state: MonthCloseState;
  month: number;
  year: number;
  onClose: () => void;
  onDownload: () => void;
  closing?: boolean;
  downloading?: boolean;
}

/** "2 transactions untagged · waiting on Bo's income" */
const describeBlockers = (state: MonthCloseState): string => {
  const parts: string[] = [];
  const { untaggedCount, membersMissingIncome } = state.readiness;
  if (untaggedCount > 0) {
    parts.push(
      `${untaggedCount} ${untaggedCount === 1 ? 'transaction' : 'transactions'} untagged`,
    );
  }
  for (const member of membersMissingIncome) {
    parts.push(`waiting on ${member.name ?? member.email}'s income`);
  }
  return parts.join(' · ');
};

/**
 * The month's close state, stated rather than hidden behind a disabled button.
 *
 * There is deliberately no Reopen affordance and no action beside the late
 * notice: nothing in this release reopens a month, and copy must not promise
 * what does not exist.
 */
const MonthCloseCard: React.FC<MonthCloseCardProps> = ({
  state,
  month,
  year,
  onClose,
  onDownload,
  closing,
  downloading,
}) => {
  const monthLabel = formatMonthYear(month, year);

  if (state.closed) {
    return (
      <div className={`${styles.card} ${styles.closed}`}>
        <div className={styles.text}>
          <span className={styles.badge}>Closed</span>
          <span className={styles.detail}>
            {monthLabel} is filed
            {state.closedAt
              ? ` — ${new Date(state.closedAt).toLocaleDateString('en-CA', {
                  dateStyle: 'medium',
                })}`
              : ''}
          </span>
          {state.lateTransactionCount > 0 && (
            <span className={styles.late}>
              {state.lateTransactionCount} new{' '}
              {state.lateTransactionCount === 1 ? 'transaction' : 'transactions'}{' '}
              since you closed {monthLabel.split(' ')[0]}.
            </span>
          )}
        </div>
        <YButton
          variant="secondary"
          onClick={onDownload}
          isDisabled={downloading}
        >
          {downloading ? 'Preparing…' : 'Download PDF'}
        </YButton>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.text}>
        <span className={styles.detail}>
          {state.readiness.canClose
            ? `${monthLabel} is ready to close.`
            : `${monthLabel} is not ready to close.`}
        </span>
        {!state.readiness.canClose && (
          <span className={styles.blockers}>{describeBlockers(state)}</span>
        )}
      </div>
      <YButton
        variant="primary"
        onClick={onClose}
        isDisabled={!state.readiness.canClose || closing}
      >
        {closing ? 'Closing…' : 'Close the month'}
      </YButton>
    </div>
  );
};

export default MonthCloseCard;
