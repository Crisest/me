import React, { InputHTMLAttributes, useRef } from 'react';
import { useTextField, AriaTextFieldProps } from '@react-aria/textfield';
import styles from './Textbox.module.css';

interface TextBoxProps extends InputHTMLAttributes<HTMLInputElement> {
  customClass?: string;
  fullWidth?: boolean;
}

type TextBoxAriaProps = AriaTextFieldProps & TextBoxProps;

const Textbox: React.FC<TextBoxAriaProps> = ({
  customClass,
  fullWidth,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const ariaTextFieldProps: AriaTextFieldProps = { ...rest };

  const { inputProps } = useTextField(ariaTextFieldProps, inputRef);
  return (
    <input
      type="text"
      className={`${styles.textbox} ${customClass} ${fullWidth ? styles.fullWidth : ''}`}
      {...inputProps}
    />
  );
};

export default Textbox;
