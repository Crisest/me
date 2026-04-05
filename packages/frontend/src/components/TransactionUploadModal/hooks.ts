import { useMemo, useState } from 'react';
import {
  useCreateBankMutation,
  useGetBanksQuery,
} from '@/services/bankService';
import { ComboboxUtils } from '@/utils/combobox';
import {
  useCreateCardMutation,
  useGetCardsQuery,
} from '@/services/cardService';

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

export const useCardSelect = (selectedBankId?: string) => {
  const [selectedCard, setSelectedCard] = useState<string>();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: cards, isLoading, error } = useGetCardsQuery();
  const [createCard] = useCreateCardMutation();

  const handleCreateCard = () => {
    if (!selectedBankId) return;
    createCard({ name: searchQuery, bankId: selectedBankId });
  };

  const filteredCards = useMemo(
    () =>
      (cards ?? []).filter(
        card => !selectedBankId || card.bankId === selectedBankId
      ),
    [cards, selectedBankId]
  );

  const cardOptions = useMemo(
    () => ComboboxUtils.cardsToOptions(filteredCards),
    [filteredCards]
  );

  return {
    cardState: [selectedCard, setSelectedCard] as const,
    searchState: [searchQuery, setSearchQuery] as const,
    cardOptions,
    isLoading,
    error,
    handleCreateCard,
    canCreateCard: !!selectedBankId,
  };
};
