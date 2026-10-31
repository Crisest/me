import React, { ReactNode, ButtonHTMLAttributes, useRef } from 'react';
import styles from './Button.module.css';
import { useButton, AriaButtonProps } from 'react-aria';

interface YButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'link' | 'cta' | 'styleless';
  customClass?: string | null;
  fullWidth?: boolean;
  icon?: ReactNode;
  /** Count pill after the label; hidden when 0 or undefined. */
  badge?: number;
}
type ButtonProps = AriaButtonProps & YButtonProps;

const YButton: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  customClass,
  fullWidth,
  icon,
  badge,
  ...rest
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(rest, ref);
  const classNames = [
    styles.button,
    styles[variant],
    customClass,
    fullWidth ? styles.fullWidth : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  // react-aria's filterDOMProps keeps only `id` and the labelable aria-*
  // props, so `title` never reaches the DOM through buttonProps. Forward it
  // explicitly — an icon-only button has no visible text to explain itself.
  return (
    <button
      className={classNames}
      {...buttonProps}
      title={rest.title}
      ref={ref}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
      {!!badge && <span className={styles.badge}>{badge}</span>}
    </button>
  );
};

export default YButton;
