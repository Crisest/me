import React, { ReactNode, ButtonHTMLAttributes, useRef } from 'react';
import styles from './Button.module.css';
import { useButton, AriaButtonProps } from 'react-aria';

interface YButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'link' | 'cta' | 'styleless';
  customClass?: string | null;
  fullWidth?: boolean;
  icon?: ReactNode;
}
type ButtonProps = AriaButtonProps & YButtonProps;

const YButtom: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  customClass,
  fullWidth,
  icon,
  ...rest
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(rest, ref);
  const classNames = `${styles.button} ${styles[variant]} ${customClass} ${fullWidth ? styles.fullWidth : ''}`;

  return (
    <button className={classNames} {...buttonProps} ref={ref}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children && children}
    </button>
  );
};

export default YButtom;
