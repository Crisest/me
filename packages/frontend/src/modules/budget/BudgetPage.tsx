import { useState } from 'react';
import Header from '@/components/Header/Header';
import { Transaction } from '@portfolio/common';
import TransactionsTable from '@/components/TransactionsTable/TransactionsTable';
import YButtom from '@/components/Button/Button';
import {
  useCreateManyTransactionsMutation,
  useGetTransactionsQuery,
} from '@/services/transactionService';
import Content from '@/components/Layout/Content/Content';
import YmFlex from '@/components/Layout/YmFlex/YmFlex/YmFlex';
import months from '@/constants/months';
import YmCombobox from '@/components/YmCombobox/YmCombobox';
import TransactionUploadModal from '@/components/TransactionUploadModal/TransactionUploadModal';

export const BudgetPage = () => {
  const [saveTransactions, result] = useCreateManyTransactionsMutation();
  const previousMonth = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState(previousMonth);
  const { data: transactionsData, isLoading } =
    useGetTransactionsQuery(selectedMonth);
  const [openUploadModal, setOpenUploadModal] = useState(false);

  return (
    <>
      <Header title="Budget" />
      <Content>
        <YmFlex justify="space-between" align="center">
          <YmCombobox
            options={months}
            value={selectedMonth}
            onChange={newMonth => setSelectedMonth(newMonth)}
            placeholder="Select a month"
            ariaLabel="Month filter"
          />
          {/* <FileUpload onFileSelect={handleFileSelect} /> */}
          <YButtom onClick={() => setOpenUploadModal(true)}>Upload CSV</YButtom>
        </YmFlex>
        {transactionsData && (
          <TransactionsTable transactions={transactionsData} />
        )}
      </Content>
      <TransactionUploadModal
        openUploadModal={openUploadModal}
        setOpenUploadModal={setOpenUploadModal}
      />
    </>
  );
};
