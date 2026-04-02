import React, { ReactNode } from 'react';
import styles from './Content.module.css';

interface ContentProps {
  children: ReactNode;
  className?: string;
}

const Content: React.FC<ContentProps> = ({ children, className }) => (
  <div className={`${styles.content} ${className ?? ''}`.trim()}>
    {children}
  </div>
);

export default Content;
