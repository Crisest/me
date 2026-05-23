import React, { InputHTMLAttributes, useRef } from 'react';
import { useTextField, AriaTextFieldProps } from '@react-aria/textfield';
import styles from './Textbox.module.css';

interface TextBoxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  customClass?: string;
  fullWidth?: boolean;
}

type TextBoxAriaProps = AriaTextFieldProps & TextBoxProps;

const Textbox: React.FC<TextBoxAriaProps> = ({
  customClass,
  fullWidth,
  label,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { labelProps, inputProps } = useTextField(
    { ...rest, label } as AriaTextFieldProps,
    inputRef,
  );
  const classNames = [
    styles.textbox,
    customClass,
    fullWidth ? styles.fullWidth : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  const input = (
    <input ref={inputRef} type="text" className={classNames} {...inputProps} />
  );

  if (!label) return input;

  const wrapperClass = [styles.field, fullWidth ? styles.fullWidth : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass}>
      <label {...labelProps} className={styles.label}>
        {label}
      </label>
      {input}
    </div>
  );
};

export default Textbox;
