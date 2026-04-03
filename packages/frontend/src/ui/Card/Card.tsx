import styles from './Card.module.css';

interface CardProps {
  label: string;
  amount: string;
  subtitle: string;
  loading?: boolean;
}

export function Card({ label, amount, subtitle, loading }: CardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      {loading ? (
        <>
          <div className={`${styles.skeleton} ${styles.skeletonAmount}`} />
          <div className={`${styles.skeleton} ${styles.skeletonSubtitle}`} />
        </>
      ) : (
        <>
          <div className={styles.amount}>{amount}</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </>
      )}
    </div>
  );
}
