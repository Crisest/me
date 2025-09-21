import YmDialog from '../YmDialog/YmDialog';
import FileUpload from '../FileUpload/FileUpload';
import { parseFileContent } from '@/utils/fileReader';
import { parseCSVToTransaction } from '@/utils/csv';
import { useState } from 'react';
import { Transaction } from '@portfolio/common';

const TransactionUploadModal = ({
  openUploadModal,
  setOpenUploadModal,
}: {
  openUploadModal: boolean;
  setOpenUploadModal: (open: boolean) => void;
}) => {
  const [tempTransactions, setTempTransactions] = useState<Transaction[]>();
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
    </YmDialog>
  );
};

export default TransactionUploadModal;
