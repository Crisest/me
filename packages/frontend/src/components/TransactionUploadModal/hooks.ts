import { useMemo, useState } from 'react';
import {
  useCreateBankMutation,
  useGetBanksQuery,
} from '@/services/bankService';
import { ComboboxUtils } from '@/utils/combobox';
import {
  useCreateAccountMutation,
  useGetAccountsQuery,
} from '@/services/accountService';

export const useBankSelect = () => {
  const [selectedBank, setSelectedBank] = useState<string>();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: banks, isLoading, error } = useGetBanksQuery();
  const [createBank] = useCreateBankMutation();

  const handleCreateBank = () => {
    createBank({ name: searchQuery });
  };

  const bankOptions = useMemo(
    () => ComboboxUtils.banksToOptions(banks),
    [banks]
  );

  return {
    bankState: [selectedBank, setSelectedBank] as const,
    searchState: [searchQuery, setSearchQuery] as const,
    bankOptions,
    isLoading,
    error,
    handleCreateBank,
  };
};

export const useAccountSelect = (selectedBankId?: string) => {
  const [selectedAccount, setSelectedAccount] = useState<string>();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: accounts, isLoading, error } = useGetAccountsQuery();
  const [createAccount] = useCreateAccountMutation();

  const handleCreateAccount = () => {
    if (!selectedBankId) return;
    createAccount({ name: searchQuery, bankId: selectedBankId });
  };

  const filteredAccounts = useMemo(
    () =>
      (accounts ?? []).filter(
        account => !selectedBankId || account.bankId === selectedBankId,
      ),
    [accounts, selectedBankId],
  );

  const accountOptions = useMemo(
    () => ComboboxUtils.accountsToOptions(filteredAccounts),
    [filteredAccounts],
  );

  return {
    accountState: [selectedAccount, setSelectedAccount] as const,
    searchState: [searchQuery, setSearchQuery] as const,
    accountOptions,
    isLoading,
    error,
    handleCreateAccount,
    canCreateAccount: !!selectedBankId,
  };
};
