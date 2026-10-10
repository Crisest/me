import YmDialog from '@ui/YmDialog/YmDialog';
import FileUpload from '@ui/FileUpload/FileUpload';
import { parseFileContent, computeFileHash } from '@/utils/fileReader';
import { paparseCSVToTransaction } from '@/utils/csv';
import { useState } from 'react';
import { Transaction } from '@portfolio/common';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import YmFlex from '@ui/YmFlex/YmFlex';
import { useBankSelect, useAccountSelect } from './hooks';
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
  const [resultMessage, setResultMessage] = useState<string>();
  const [error, setError] = useState<string>();
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
    accountState: [selectedAccount, setSelectedAccount],
    searchState: [accountSearchQuery, setAccountSearchQuery],
    accountOptions,
    isLoading: accountsLoading,
    handleCreateAccount,
    canCreateAccount,
  } = useAccountSelect(selectedBank);

  const handleFileSelect = async (file: File) => {
    setDuplicateWarning(undefined);
    setResultMessage(undefined);
    setError(undefined);
    setTempTransactions(undefined);
    setFileName('');
    setFileHash('');

    try {
      const transactionData = await parseFileContent(
        file,
        paparseCSVToTransaction,
      );
      setTempTransactions(transactionData);
      setFileName(file.name);
    } catch (error) {
      console.error('Error parsing file:', error);
      setError(error instanceof Error ? error.message : 'Failed to parse file');
      return;
    }

    let hash: string;
    try {
      hash = await computeFileHash(file);
    } catch (error) {
      console.error('Error hashing file:', error);
      setError(
        `Could not fingerprint this file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    setFileHash(hash);

    if (selectedAccount) {
      try {
        const result = await checkDuplicate({
          fileName: file.name,
          fileHash: hash,
          accountId: selectedAccount,
        }).unwrap();

        if (result.isDuplicate) {
          setDuplicateWarning(
            `This file appears to have been uploaded before (${result.existingUpload?.fileName}). You can still proceed if intended.`
          );
        }
      } catch (error) {
        console.error('Error checking for duplicate upload:', error);
      }
    }
  };

  const handleSubmit = async () => {
    if (!tempTransactions || !selectedAccount || !fileName || !fileHash) return;

    setError(undefined);
    try {
      const { transactions, skipped } = await saveTransactions({
        transactions: tempTransactions,
        accountId: selectedAccount,
        fileName,
        fileHash,
      }).unwrap();
      if (skipped > 0) {
        setResultMessage(
          `Imported ${transactions.length}. Skipped ${skipped} already present on this account.`,
        );
        setTempTransactions(undefined);
        return;
      }
      setTempTransactions(undefined);
      setFileName('');
      setFileHash('');
      setDuplicateWarning(undefined);
      setOpenUploadModal(false);
    } catch (error) {
      console.error('Failed to save transactions:', error);
      const message = (error as { data?: { message?: unknown } })?.data
        ?.message;
      setError(
        typeof message === 'string' ? message : 'Failed to save transactions',
      );
    }
  };

  return (
    <YmDialog
      isOpen={openUploadModal}
      onClose={() => {
        setResultMessage(undefined);
        setError(undefined);
        setOpenUploadModal(false);
      }}
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
            setSelectedAccount(undefined);
          }}
          placeholder="Select a bank"
          createButtonText="Create new bank"
          isLoading={banksLoading}
          onCreateNew={handleCreateBank}
          onQueryChange={setBankSearchQuery}
          query={bankSearchQuery}
        />
        <YmCombobox
          options={accountOptions}
          value={selectedAccount}
          onChange={setSelectedAccount}
          placeholder={
            selectedBank ? 'Select an account' : 'Select a bank first'
          }
          createButtonText="Create new account"
          isLoading={accountsLoading}
          onCreateNew={canCreateAccount ? handleCreateAccount : undefined}
          onQueryChange={setAccountSearchQuery}
          query={accountSearchQuery}
        />
        <FileUpload onFileSelect={handleFileSelect} buttonText="Upload file" />

        {duplicateWarning && (
          <p style={{ color: 'var(--color-warning, #e67e22)', margin: 0 }}>
            {duplicateWarning}
          </p>
        )}

        {error && (
          <p style={{ color: 'var(--color-error, #c0392b)', margin: 0 }}>
            {error}
          </p>
        )}

        {resultMessage && <p style={{ margin: 0 }}>{resultMessage}</p>}

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
