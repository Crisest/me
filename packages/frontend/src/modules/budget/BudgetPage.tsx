import { useState } from 'react';
import Header from '@/components/Header/Header';
import TransactionsTable from '@/components/TransactionsTable/TransactionsTable';
import YButtom from '@/components/Button/Button';
import { useGetTransactionsQuery } from '@/services/transactionService';
import Content from '@/components/Layout/Content/Content';
import YmFlex from '@/components/Layout/YmFlex/YmFlex/YmFlex';
import { months, years } from '@/constants/date';
import YmCombobox from '@/components/YmCombobox/YmCombobox';
import TransactionUploadModal from '@/components/TransactionUploadModal/TransactionUploadModal';
import BudgetModal from '@/components/BudgetModal/BudgetModal';

export const BudgetPage = () => {
  const now = new Date();
  const prevMonthIndex = (now.getMonth() + 11) % 12; // 0-11 previous month
  const previousMonth = prevMonthIndex + 1; // 1-12
  const [selectedMonth, setSelectedMonth] = useState(previousMonth);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const { data: transactionsData, isLoading } = useGetTransactionsQuery({
    month: selectedMonth,
    year: selectedYear,
  });
  const [openUploadModal, setOpenUploadModal] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);

  return (
    <>
      <Header title="Budget" />
      <Content>
        <YmFlex justify="end" align="center" gap={30}>
          <YmCombobox
            options={months}
            value={selectedMonth}
            onChange={newMonth => setSelectedMonth(newMonth)}
            placeholder="Select a month"
            ariaLabel="Month filter"
          />
          <YmCombobox
            options={years}
            value={selectedYear}
            onChange={newYear => setSelectedYear(newYear)}
            placeholder="Select a year"
            ariaLabel="Year filter"
          />
          {/* <FileUpload onFileSelect={handleFileSelect} /> */}
          <YButtom onClick={() => setOpenUploadModal(true)}>Upload CSV</YButtom>
          <YButtom onClick={() => setOpenBudgetModal(true)}>
            Setup Budget
          </YButtom>
        </YmFlex>
        {transactionsData && (
          <TransactionsTable transactions={transactionsData} />
        )}
      </Content>
      <TransactionUploadModal
        openUploadModal={openUploadModal}
        setOpenUploadModal={setOpenUploadModal}
      />
      <BudgetModal
        openModal={openBudgetModal}
        setOpenModal={setOpenBudgetModal}
      />
    </>
  );
};
