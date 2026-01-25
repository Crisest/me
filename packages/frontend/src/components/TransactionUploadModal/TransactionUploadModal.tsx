import YmDialog from '../YmDialog/YmDialog';
import FileUpload from '../FileUpload/FileUpload';
import { parseFileContent } from '@/utils/fileReader';
import { paparseCSVToTransaction } from '@/utils/csv';
import { useState } from 'react';
import { Transaction } from '@portfolio/common';
import YmCombobox from '../YmCombobox/YmCombobox';
import YmFlex from '../Layout/YmFlex/YmFlex/YmFlex';
import { useBankSelect, useCardSelect } from './hooks';
import TransactionsTable from '../TransactionsTable/TransactionsTable';
import styles from './TransactionsUploadModal.module.css';
import { useCreateManyTransactionsMutation } from '@/services/transactionService';

const TransactionUploadModal = ({
  openUploadModal,
  setOpenUploadModal,
}: {
  openUploadModal: boolean;
  setOpenUploadModal: (open: boolean) => void;
}) => {
  const [tempTransactions, setTempTransactions] = useState<Transaction[]>();
  const [saveTransactions, result] = useCreateManyTransactionsMutation();

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
        paparseCSVToTransaction,
      );
      setTempTransactions(transactionData);
    } catch (error) {
      console.error('Error processing file:', error);
    }
  };

  const handleSubmit = async () => {
    if (!tempTransactions || !selectedBank || !selectedCard) return;

    try {
      await saveTransactions({
        transactions: tempTransactions,
        bankId: selectedBank,
        cardId: selectedCard,
      }).unwrap();
      setTempTransactions(undefined);
      setOpenUploadModal(false);
    } catch (error) {
      console.error('Failed to save transactions:', error);
    }
  };
  // TODO: Default last use bank and card, leverage local storage

  return (
    <YmDialog
      isOpen={openUploadModal}
      onClose={() => setOpenUploadModal(false)}
      title="Upload transactions"
      footerButtonText="Save"
      footerButtonAction={handleSubmit}
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
