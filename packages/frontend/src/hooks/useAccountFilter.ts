import { useEffect, useMemo, useState } from 'react';
import { Transaction } from '@/types';
import { Option } from '@ui/YmCombobox/YmCombobox';

export const ALL_ACCOUNTS_ID = '__all__';

const buildAccountKey = (tx: Transaction): string => {
  const bank = tx.bankName ?? '';
  const account = tx.accountName ?? '';
  const mask = tx.accountMask ?? '';
  const card = tx.cardName ?? '';
  return `${bank}|${account}|${mask}|${card}`;
};

const buildAccountLabel = (tx: Transaction): string => {
  if (tx.accountName) {
    const masked = tx.accountMask
      ? `${tx.accountName} ••${tx.accountMask}`
      : tx.accountName;
    return tx.bankName ? `${tx.bankName} · ${masked}` : masked;
  }
  if (tx.cardName) {
    return tx.bankName ? `${tx.bankName} · ${tx.cardName}` : tx.cardName;
  }
  return 'Unknown account';
};

export interface UseAccountFilterResult {
  options: Option<string>[];
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
  filteredTransactions: Transaction[];
}

export function useAccountFilter(
  transactions: Transaction[] | undefined,
): UseAccountFilterResult {
  const [selectedAccountId, setSelectedAccountId] =
    useState<string>(ALL_ACCOUNTS_ID);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    (transactions ?? []).forEach(tx => {
      const key = buildAccountKey(tx);
      if (!map.has(key)) map.set(key, buildAccountLabel(tx));
    });
    return map;
  }, [transactions]);

  const options = useMemo<Option<string>[]>(() => {
    const accountOptions: Option<string>[] = Array.from(accountMap.entries())
      .map(([id, label]) => ({ id, label, value: id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [
      { id: ALL_ACCOUNTS_ID, label: 'All accounts', value: ALL_ACCOUNTS_ID },
      ...accountOptions,
    ];
  }, [accountMap]);

  useEffect(() => {
    if (
      selectedAccountId !== ALL_ACCOUNTS_ID &&
      !accountMap.has(selectedAccountId)
    ) {
      setSelectedAccountId(ALL_ACCOUNTS_ID);
    }
  }, [accountMap, selectedAccountId]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (selectedAccountId === ALL_ACCOUNTS_ID) return transactions;
    return transactions.filter(
      tx => buildAccountKey(tx) === selectedAccountId,
    );
  }, [transactions, selectedAccountId]);

  return {
    options,
    selectedAccountId,
    setSelectedAccountId,
    filteredTransactions,
  };
}
