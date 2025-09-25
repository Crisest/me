import YmDialog from '../YmDialog/YmDialog';
import FileUpload from '../FileUpload/FileUpload';
import { parseFileContent } from '@/utils/fileReader';
import { parseCSVToTransaction } from '@/utils/csv';
import { useState } from 'react';
import { Transaction } from '@portfolio/common';
import YmCombobox from '../YmCombobox/YmCombobox';
import YmFlex from '../Layout/YmFlex/YmFlex/YmFlex';
import { useBankSelect, useCardSelect } from './hooks';
import TransactionsTable from '../TransactionsTable/TransactionsTable';
import styles from './TransactionsUploadModal.module.css';

const TransactionUploadModal = ({
  openUploadModal,
  setOpenUploadModal,
}: {
  openUploadModal: boolean;
  setOpenUploadModal: (open: boolean) => void;
}) => {
  const [tempTransactions, setTempTransactions] = useState<Transaction[]>();

  const {
    bankState: [selectedBank, setSelectedBank],
    searchState: [bankSearchQuery, setBankSearchQuery],
    bankOptions,
    isLoading: banksLoading,
    handleCreateBank,
  } = useBankSelect();

  const {
    cardState: [selectedCard, setSelectedCard],
    searchState: [cardSearchQuery, setCardSearchQuery],
    cardOptions,
    isLoading: cardsLoading,
    handleCreateCard,
  } = useCardSelect();

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

  return (
    <YmDialog
      isOpen={openUploadModal}
      onClose={() => setOpenUploadModal(false)}
      title="Upload transactions"
      footerButtonText="Save"
      footerButtonAction={() => {}}
    >
      <YmFlex gap={16} direction="column">
        <YmCombobox
          options={bankOptions}
          value={selectedBank}
          onChange={setSelectedBank}
          placeholder="Select a bank"
          createButtonText="Create new bank"
          isLoading={banksLoading}
          onCreateNew={handleCreateBank}
          onQueryChange={setBankSearchQuery}
          query={bankSearchQuery}
        />
        <YmCombobox
          options={cardOptions}
          value={selectedCard}
          onChange={setSelectedCard}
          placeholder="Select a card"
          createButtonText="Create new card"
          isLoading={cardsLoading}
          onCreateNew={handleCreateCard}
          onQueryChange={setCardSearchQuery}
          query={cardSearchQuery}
        />
        <FileUpload onFileSelect={handleFileSelect} buttonText="Upload file" />

        {tempTransactions && (
          <>
            <h3>Preview ...</h3>
            <div className={styles.tableContainer}>
              <TransactionsTable transactions={tempTransactions} />
            </div>
          </>
        )}
      </YmFlex>
    </YmDialog>
  );
};

export default TransactionUploadModal;
