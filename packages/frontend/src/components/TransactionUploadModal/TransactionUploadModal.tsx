import YmDialog from '@ui/YmDialog/YmDialog';
import FileUpload from '@ui/FileUpload/FileUpload';
import { parseFileContent, computeFileHash } from '@/utils/fileReader';
import { paparseCSVToTransaction } from '@/utils/csv';
import { useState } from 'react';
import { Transaction } from '@portfolio/common';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import YmFlex from '@ui/YmFlex/YmFlex';
import { useBankSelect, useCardSelect } from './hooks';
import TransactionsTable from '../TransactionsTable/TransactionsTable';
import styles from './TransactionsUploadModal.module.css';
import { useCreateManyTransactionsMutation } from '@/services/transactionService';
import { useCheckDuplicateUploadMutation } from '@/services/uploadService';

const TransactionUploadModal = ({
  openUploadModal,
  setOpenUploadModal,
}: {
  openUploadModal: boolean;
  setOpenUploadModal: (open: boolean) => void;
}) => {
  const [tempTransactions, setTempTransactions] = useState<Transaction[]>();
  const [fileName, setFileName] = useState<string>('');
  const [fileHash, setFileHash] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string>();
  const [saveTransactions] = useCreateManyTransactionsMutation();
  const [checkDuplicate] = useCheckDuplicateUploadMutation();

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
    canCreateCard,
  } = useCardSelect(selectedBank);

  const handleFileSelect = async (file: File) => {
    try {
      setDuplicateWarning(undefined);
      const [transactionData, hash] = await Promise.all([
        parseFileContent(file, paparseCSVToTransaction),
        computeFileHash(file),
      ]);
      setTempTransactions(transactionData);
      setFileName(file.name);
      setFileHash(hash);

      if (selectedCard) {
        const result = await checkDuplicate({
          fileName: file.name,
          fileHash: hash,
          cardId: selectedCard,
        }).unwrap();

        if (result.isDuplicate) {
          setDuplicateWarning(
            `This file appears to have been uploaded before (${result.existingUpload?.fileName}). You can still proceed if intended.`
          );
        }
      }
    } catch (error) {
      console.error('Error processing file:', error);
    }
  };

  const handleSubmit = async () => {
    if (!tempTransactions || !selectedCard || !fileName || !fileHash) return;

    try {
      await saveTransactions({
        transactions: tempTransactions,
        cardId: selectedCard,
        fileName,
        fileHash,
      }).unwrap();
      setTempTransactions(undefined);
      setFileName('');
      setFileHash('');
      setDuplicateWarning(undefined);
      setOpenUploadModal(false);
    } catch (error) {
      console.error('Failed to save transactions:', error);
    }
  };

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
          onChange={(value) => {
            setSelectedBank(value);
            setSelectedCard(undefined);
          }}
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
          placeholder={selectedBank ? 'Select a card' : 'Select a bank first'}
          createButtonText="Create new card"
          isLoading={cardsLoading}
          onCreateNew={canCreateCard ? handleCreateCard : undefined}
          onQueryChange={setCardSearchQuery}
          query={cardSearchQuery}
        />
        <FileUpload onFileSelect={handleFileSelect} buttonText="Upload file" />

        {duplicateWarning && (
          <p style={{ color: 'var(--color-warning, #e67e22)', margin: 0 }}>
            {duplicateWarning}
          </p>
        )}

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
