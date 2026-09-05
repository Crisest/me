import React, { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  /** Filters and menus, right-aligned on the same line as the title. */
  children?: ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, children }) => (
  <div className={styles.header}>
    <h1 className={styles.title}>{title}</h1>
    {children && <div className={styles.controls}>{children}</div>}
  </div>
);

export default PageHeader;
