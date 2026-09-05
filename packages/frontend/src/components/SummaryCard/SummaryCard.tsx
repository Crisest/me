import styles from './SummaryCard.module.css';

export type SummaryTone = 'positive' | 'negative' | 'neutral';

export interface SummaryStat {
  label: string;
  amount: string;
  /** Short fragment under the amount — "1 of 1 paid". Never a sentence. */
  note?: string;
}

interface SummaryCardProps {
  label: string;
  amount: string;
  tone: SummaryTone;
  stats: SummaryStat[];
  loading?: boolean;
  /** 'accent' marks this card as the page's hero surface — there should be one per page. */
  variant?: 'plain' | 'accent';
}

const toneClass: Record<SummaryTone, string> = {
  positive: styles.positive,
  negative: styles.negative,
  neutral: styles.neutral,
};

export function SummaryCard({
  label,
  amount,
  tone,
  stats,
  loading,
  variant = 'plain',
}: SummaryCardProps) {
  return (
    <div
      className={
        variant === 'accent'
          ? `${styles.card} ${styles.accentCard}`
          : styles.card
      }
    >
      <div className={styles.primary}>
        <div className={styles.label}>{label}</div>
        {loading ? (
          <div className={`${styles.skeleton} ${styles.skeletonAmount}`} />
        ) : (
          <div className={`${styles.amount} ${toneClass[tone]}`}>{amount}</div>
        )}
      </div>

      <div className={styles.stats}>
        {stats.map(stat => (
          <div key={stat.label} className={styles.stat}>
            <div className={styles.label}>{stat.label}</div>
            {loading ? (
              <div className={`${styles.skeleton} ${styles.skeletonStat}`} />
            ) : (
              <>
                <div className={styles.statAmount}>{stat.amount}</div>
                {stat.note && <div className={styles.note}>{stat.note}</div>}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
