import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import React, { Dispatch, SetStateAction, useState } from 'react';
import { IoChevronDownCircleOutline } from 'react-icons/io5';
import styles from './YmCombobox.module.css';

export interface Option<T> {
  id: number | string;
  label: string;
  value: T;
}

interface YmComboboxProps<T> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const YmCombobox = <T,>({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  ariaLabel,
}: YmComboboxProps<T>) => {
  const [query, setQuery] = useState('');

  const filteredOptions =
    query === ''
      ? options
      : options.filter(option =>
          option.label.toLowerCase().includes(query.toLowerCase()),
        );

  const getDisplayValue = (val: T) => {
    const selectedOption = options.find(option => option.value === val);
    return selectedOption ? selectedOption.label : '';
  };
  return (
    <Combobox value={value} onChange={onChange} onClose={() => setQuery('')}>
      <div className={styles.combobox}>
        <ComboboxInput
          aria-label={ariaLabel}
          className={styles.input}
          placeholder={placeholder}
          onChange={event => setQuery(event.target.value)}
          displayValue={getDisplayValue}
        />
        <ComboboxButton className={styles.button}>
          <IoChevronDownCircleOutline />
        </ComboboxButton>

        <ComboboxOptions className={styles.options}>
          {filteredOptions.map(option => (
            <ComboboxOption
              key={option.id}
              value={option.value}
              className={styles.option}
            >
              {option.label}
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
};

export default YmCombobox;
