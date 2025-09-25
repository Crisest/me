import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import React, { Dispatch, SetStateAction, useState } from 'react';
import { IoChevronDownCircleOutline } from 'react-icons/io5';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import styles from './YmCombobox.module.css';
import YButtom from '../Button/Button';

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
  onCreateNew?: () => void;
  createButtonText?: string;
  isLoading?: boolean;
  onQueryChange?: (query: string) => void;
  query?: string;
}

const YmCombobox = <T,>({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  ariaLabel,
  onCreateNew,
  createButtonText = 'Create New',
  isLoading = false,
  onQueryChange,
  query: externalQuery,
}: YmComboboxProps<T>) => {
  const [internalQuery, setInternalQuery] = useState('');
  const query = externalQuery ?? internalQuery;

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

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;
    if (onQueryChange) {
      onQueryChange(newQuery);
    } else {
      setInternalQuery(newQuery);
    }
  };
  return (
    <Combobox
      value={value}
      onChange={onChange}
      onClose={() => (onQueryChange ? onQueryChange('') : setInternalQuery(''))}
    >
      <div className={styles.combobox}>
        <ComboboxInput
          aria-label={ariaLabel}
          className={styles.input}
          placeholder={placeholder}
          onChange={handleQueryChange}
          displayValue={getDisplayValue}
        />
        <ComboboxButton className={styles.button}>
          {isLoading ? (
            <AiOutlineLoading3Quarters
              className={`${styles.loadingIcon} animate-spin`}
            />
          ) : (
            <IoChevronDownCircleOutline />
          )}
        </ComboboxButton>

        <ComboboxOptions className={styles.options}>
          <div className={styles.optionsWrapper}>
            {filteredOptions.map(option => (
              <ComboboxOption
                key={option.id}
                value={option.value}
                className={styles.option}
              >
                {option.label}
              </ComboboxOption>
            ))}
          </div>
          {onCreateNew && (
            <div className={styles.footer}>
              <YButtom type="button" onClick={onCreateNew} fullWidth>
                {createButtonText}
              </YButtom>
            </div>
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
};

export default YmCombobox;
