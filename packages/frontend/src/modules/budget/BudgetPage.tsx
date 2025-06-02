import { useState } from 'react';
import FileUpload from '@/components/FileUpload/FileUpload';
import Header from '@/components/Header/Header';
import { parseCSVToTransaction } from '@/utils/csv';
import { parseFileContent } from '@/utils/fileReader';
import { Transaction } from '@portfolio/common';
import TransactionsTable from '@/components/TransactionsTable/TransactionsTable';

export const BudgetPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const handleFileSelect = async (file: File) => {
    try {
      const transactionData = await parseFileContent(
        file,
        parseCSVToTransaction,
      );
      setTransactions(transactionData);
    } catch (error) {
      console.error('Error processing file:', error);
    }
  };

  // different page to see the summary per month
  return (
    <>
      <Header title="Budget" />
      {transactions.length === 0 ? (
        <FileUpload onFileSelect={handleFileSelect} />
      ) : (
        <TransactionsTable transactions={transactions} />
      )}
    </>
  );
};
