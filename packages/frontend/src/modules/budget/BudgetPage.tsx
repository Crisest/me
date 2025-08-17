import { useState } from 'react';
import FileUpload from '@/components/FileUpload/FileUpload';
import Header from '@/components/Header/Header';
import { parseCSVToTransaction } from '@/utils/csv';
import { parseFileContent } from '@/utils/fileReader';
import { Transaction } from '@portfolio/common';
import TransactionsTable from '@/components/TransactionsTable/TransactionsTable';
import YButtom from '@/components/Button/Button';
import {
  useCreateManyTransactionsMutation,
  useGetTransactionsQuery,
} from '@/services/transactionService';
import Content from '@/components/Content/Content';
import MonthSelect from '@/components/BudgetComponents/MonthSelect/MonthSelect';
import YmFlex from '@/components/Layout/YmFlex/YmFlex';

export const BudgetPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [saveTransactions, result] = useCreateManyTransactionsMutation();
  const { data: transactionsData, isLoading } = useGetTransactionsQuery();

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

  const handleClick = () => {
    saveTransactions(transactions);
  };

  // different page to see the summary per month
  return (
    <>
      <Header title="Budget" />
      {transactions.length === 0 ? (
        <Content>
          <YmFlex justify="space-between" align="center">
            <MonthSelect />
            <FileUpload onFileSelect={handleFileSelect} />
          </YmFlex>
          {transactionsData && (
            <TransactionsTable transactions={transactionsData} />
          )}
        </Content>
      ) : (
        <>
          <TransactionsTable transactions={transactions} />
          <YButtom onClick={handleClick}>Save transactions</YButtom>
        </>
      )}
    </>
  );
};
