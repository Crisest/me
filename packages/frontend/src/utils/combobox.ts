import { Option } from '@ui/YmCombobox/YmCombobox';
import { Account, Bank } from '@portfolio/common';

export namespace ComboboxUtils {
  export const banksToOptions = (banks: Bank[] = []): Option<string>[] =>
    banks.map(bank => ({
      id: bank.id,
      label: bank.name,
      value: bank.id,
    }));

  export const accountsToOptions = (
    accounts: Account[] = [],
  ): Option<string>[] =>
    accounts.map(a => ({
      id: a.id,
      label: a.mask ? `${a.name} ••${a.mask}` : a.name,
      value: a.id,
    }));
}
