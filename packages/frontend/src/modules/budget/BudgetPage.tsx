import { useState } from 'react';
import Header from '@/components/Header/Header';
import TransactionsTable from '@/components/TransactionsTable/TransactionsTable';
import YmMenu from '@ui/YmMenu/YmMenu';
import { useGetTransactionsQuery } from '@/services/transactionService';
import { useGetTransactionInsightsQuery } from '@/services/transactionService';
import {
  useGetBudgetQuery,
  useGetBudgetOverrideQuery,
} from '@/services/budgetService';
import ActualIncomeModal from '@/components/ActualIncomeModal/ActualIncomeModal';
import Content from '@ui/Content/Content';
import TransactionUploadModal from '@/components/TransactionUploadModal/TransactionUploadModal';
import BudgetModal from '@/components/BudgetModal/BudgetModal';
import {
  InsightCards,
  InsightCardItem,
} from '@/components/InsightCards/InsightCards';
import { MonthYearFilter } from '@/components/MonthYearFilter/MonthYearFilter';
import { formatCAD } from '@/utils/format';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import { useAccountFilter } from '@/hooks/useAccountFilter';

export const BudgetPage = () => {
  const now = new Date();
  const prevMonthIndex = (now.getMonth() + 11) % 12;
  const previousMonth = prevMonthIndex + 1;
  const [selectedMonth, setSelectedMonth] = useState(previousMonth);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const { data: transactionsData } = useGetTransactionsQuery({
    month: selectedMonth,
    year: selectedYear,
  });
  const { data: insights, isLoading: insightsLoading } =
    useGetTransactionInsightsQuery({
      month: selectedMonth,
      year: selectedYear,
    });
  const { data: budget, isLoading: budgetLoading } = useGetBudgetQuery();
  const { data: override, isLoading: overrideLoading } =
    useGetBudgetOverrideQuery({ month: selectedMonth, year: selectedYear });
  const [openUploadModal, setOpenUploadModal] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [openActualModal, setOpenActualModal] = useState(false);

  const {
    options: accountOptions,
    selectedAccountId,
    setSelectedAccountId,
    filteredTransactions,
  } = useAccountFilter(transactionsData);

  const effectiveSalary = override?.salary ?? budget?.salary ?? 0;
  const isActual = !!override;

  const totalFixed =
    budget?.fixedExpenses.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const remainingAfterFixed = effectiveSalary - totalFixed;
  const moneyLeft = remainingAfterFixed - (insights?.totalSpent ?? 0);

  const loading = insightsLoading || budgetLoading || overrideLoading;

  const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString(
    'en-US',
    { month: 'long' },
  );
  const headerTitle = `${monthName} ${selectedYear} Budget`;

  const cards: InsightCardItem[] = [
    {
      label: isActual ? 'Actual Income' : 'Projected Income',
      amount: `+${formatCAD(effectiveSalary)}`,
      subtitle: `${insights?.debitCount ?? 0} transactions`,
    },
    {
      label: 'Total Spent',
      amount: `-${formatCAD(insights?.totalSpent ?? 0)}`,
      subtitle: `${insights?.debitCount ?? 0} transactions`,
    },
    {
      label: 'Fixed Expenses',
      amount: `-${formatCAD(totalFixed)}`,
      subtitle: `${budget?.fixedExpenses.length ?? 0} fixed expenses`,
    },
    {
      label: 'Money Left',
      amount: formatCAD(moneyLeft),
      subtitle: 'After fixed & spending',
    },
  ];

  return (
    <>
      {/* <Header title={headerTitle} /> */}
      <InsightCards cards={cards} loading={loading} />
      <Content>
        <MonthYearFilter
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        >
          <YmCombobox
            options={accountOptions}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            placeholder="All accounts"
            ariaLabel="Account filter"
          />
          <YmMenu
            ariaLabel="Budget actions"
            items={[
              {
                label: 'Setup Budget',
                onClick: () => setOpenBudgetModal(true),
              },
              {
                label: 'Set Actual Income',
                onClick: () => setOpenActualModal(true),
              },
              { label: 'Upload CSV', onClick: () => setOpenUploadModal(true) },
            ]}
          />
        </MonthYearFilter>
        {transactionsData && (
          <TransactionsTable transactions={filteredTransactions} />
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
      <ActualIncomeModal
        openModal={openActualModal}
        setOpenModal={setOpenActualModal}
        month={selectedMonth}
        year={selectedYear}
        projectedSalary={budget?.salary ?? 0}
      />
    </>
  );
};
