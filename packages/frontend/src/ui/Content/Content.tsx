import React, { ReactNode } from 'react';
import styles from './Content.module.css';

interface ContentProps {
  children: ReactNode;
  className?: string;
  /**
   * `wide` lifts the reading-width cap for data-dense pages. Forms and prose
   * keep `default` — a 1400px line length is worse, not better.
   */
  width?: 'default' | 'wide';
}

const Content: React.FC<ContentProps> = ({
  children,
  className,
  width = 'default',
}) => (
  <div
    className={[
      styles.content,
      width === 'wide' ? styles.wide : undefined,
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </div>
);

export default Content;
