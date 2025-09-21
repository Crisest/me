import { Option } from '@/components/YmCombobox/YmCombobox';
import { Bank, Card } from '@portfolio/common';

export namespace ComboboxUtils {
  export const banksToOptions = (banks: Bank[] = []): Option<string>[] =>
    banks.map(bank => ({
      id: bank.id,
      label: bank.name,
      value: bank.id,
    }));

  export const cardsToOptions = (cards: Card[] = []): Option<string>[] =>
    cards.map(card => ({
      id: card.id,
      label: card.name,
      value: card.id,
    }));
}
