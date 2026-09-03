import React, { ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  /** Rendered as the tinted header bar. Omit for a plain surface. */
  title?: string;
  /** Right-aligned in the header bar — a total, a count. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

const Panel: React.FC<PanelProps> = ({ title, meta, children, className }) => (
  <section className={`${styles.panel} ${className ?? ''}`.trim()}>
    {title && (
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>
    )}
    {children}
  </section>
);

export default Panel;
