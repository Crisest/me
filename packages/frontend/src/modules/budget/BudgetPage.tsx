import { useState } from 'react';
import Header from '@/components/Header/Header';
import TransactionsTable from '@/components/TransactionsTable/TransactionsTable';
import YButton from '@ui/Button/Button';
import { useGetTransactionsQuery } from '@/services/transactionService';
import { useGetTransactionInsightsQuery } from '@/services/transactionService';
import { useGetBudgetQuery } from '@/services/budgetService';
import Content from '@ui/Content/Content';
import TransactionUploadModal from '@/components/TransactionUploadModal/TransactionUploadModal';
import BudgetModal from '@/components/BudgetModal/BudgetModal';
import { InsightCards, InsightCardItem } from '@/components/InsightCards/InsightCards';
import { MonthYearFilter } from '@/components/MonthYearFilter/MonthYearFilter';
import { formatCAD } from '@/utils/format';

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
    useGetTransactionInsightsQuery({ month: selectedMonth, year: selectedYear });
  const { data: budget, isLoading: budgetLoading } = useGetBudgetQuery();
  const [openUploadModal, setOpenUploadModal] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);

  const totalFixed =
    budget?.fixedExpenses.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const remainingAfterFixed = (budget?.salary ?? 0) - totalFixed;
  const moneyLeft = remainingAfterFixed - (insights?.totalSpent ?? 0);

  const loading = insightsLoading || budgetLoading;

  const cards: InsightCardItem[] = [
    {
      label: 'Budget',
      amount: `+${formatCAD(8000)}`,
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
      <Header title="Budget" />
      <InsightCards cards={cards} loading={loading} />
      <Content>
        <MonthYearFilter
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        >
          <YButton onClick={() => setOpenUploadModal(true)}>Upload CSV</YButton>
          <YButton onClick={() => setOpenBudgetModal(true)}>
            Setup Budget
          </YButton>
        </MonthYearFilter>
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
