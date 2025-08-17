import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { useState } from 'react';
import { IoChevronDownCircleOutline } from 'react-icons/io5';
import styles from './YmCombobox.module.css';

export interface Option {
  id: number | string;
  label: string;
  value: any;
}

interface YmComboboxProps {
  options: Option[];
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const YmCombobox = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  ariaLabel,
}: YmComboboxProps) => {
  const [query, setQuery] = useState('');

  const filteredOptions =
    query === ''
      ? options
      : options.filter(option =>
          option.label.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Combobox value={value} onChange={onChange} onClose={() => setQuery('')}>
      <div className={styles.combobox}>
        <ComboboxInput
          aria-label={ariaLabel}
          className={styles.input}
          placeholder={placeholder}
          onChange={event => setQuery(event.target.value)}
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
