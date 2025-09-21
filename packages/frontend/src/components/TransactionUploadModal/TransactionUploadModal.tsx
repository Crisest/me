import YmDialog from '../YmDialog/YmDialog';
import FileUpload from '../FileUpload/FileUpload';
import { parseFileContent } from '@/utils/fileReader';
import { parseCSVToTransaction } from '@/utils/csv';
import { useEffect, useState, useMemo } from 'react';
import { Transaction } from '@portfolio/common';
import { useGetBanksQuery } from '@/services/bankService';
import { useGetCardsQuery } from '@/services/cardService';

import { ComboboxUtils } from '@/utils/combobox';
import YmCombobox from '../YmCombobox/YmCombobox';

const TransactionUploadModal = ({
  openUploadModal,
  setOpenUploadModal,
}: {
  openUploadModal: boolean;
  setOpenUploadModal: (open: boolean) => void;
}) => {
  // fetch banks and cards for the comboboxes
  const {
    data: banks,
    isLoading: banksLoading,
    error: banksError,
  } = useGetBanksQuery();
  const {
    data: cards,
    isLoading: cardsLoading,
    error: cardsError,
  } = useGetCardsQuery();

  useEffect(() => {
    if (banksError) {
      console.error('Error fetching banks:', banksError);
    }
    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
    }
  }, [banksError, cardsError]);
  const [tempTransactions, setTempTransactions] = useState<Transaction[]>();
  const [selectedBank, setSelectedBank] = useState<string>();
  const [selectedCard, setSelectedCard] = useState<string>();

  const handleFileSelect = async (file: File) => {
    try {
      const transactionData = await parseFileContent(
        file,
        parseCSVToTransaction,
      );
      setTempTransactions(transactionData);
    } catch (error) {
      console.error('Error processing file:', error);
    }
  };

  const bankOptions = useMemo(
    () => ComboboxUtils.banksToOptions(banks),
    [banks],
  );
  const cardOptions = useMemo(
    () => ComboboxUtils.cardsToOptions(cards),
    [cards],
  );

  console.log(tempTransactions);
  // I will need to add the combobox for selecting or creating a bank, and a card
  return (
    <YmDialog
      isOpen={openUploadModal}
      onClose={() => setOpenUploadModal(false)}
      title="Upload CSV file"
      footerButtonText="Close"
    >
      <FileUpload onFileSelect={handleFileSelect} />
      <div className="flex flex-col gap-4">
        <YmCombobox
          options={bankOptions}
          value={selectedBank}
          onChange={setSelectedBank}
          placeholder="Select a bank"
          createButtonText="Create new bank"
          isLoading={banksLoading}
        />
        <YmCombobox
          options={cardOptions}
          value={selectedCard}
          onChange={setSelectedCard}
          placeholder="Select a card"
          createButtonText="Create new card"
          isLoading={cardsLoading}
        />
      </div>
    </YmDialog>
  );
};

export default TransactionUploadModal;
