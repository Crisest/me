import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useGetGroupsQuery,
  useGetGroupTransactionsQuery,
  useGetGroupInsightsQuery,
} from '@/services/groupService';
import Header from '@/components/Header/Header';
import Content from '@ui/Content/Content';
import TransactionsTable from '@/components/TransactionsTable/TransactionsTable';
import YmFlex from '@ui/YmFlex/YmFlex';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import { Card } from '@/ui/Card/Card';
import { months, years } from '@/constants/date';
import styles from './GroupDashboardPage.module.css';

function formatCAD(amount: number): string {
  return amount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

const GroupDashboardPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const now = new Date();
  const prevMonthIndex = (now.getMonth() + 11) % 12;
  const previousMonth = prevMonthIndex + 1;
  const [selectedMonth, setSelectedMonth] = useState(previousMonth);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { data: groups = [] } = useGetGroupsQuery();
  const group = groups.find(g => g.id === groupId);

  const { data: transactions } = useGetGroupTransactionsQuery(
    { groupId: groupId!, month: selectedMonth, year: selectedYear },
    { skip: !groupId }
  );

  const { data: insights, isLoading: insightsLoading } = useGetGroupInsightsQuery(
    { groupId: groupId!, month: selectedMonth, year: selectedYear },
    { skip: !groupId }
  );

  return (
    <>
      <Header title={group?.name ?? 'Group'} />
      <div className={styles.insightCards}>
        <Card
          label="Total Spent"
          amount={`-${formatCAD(insights?.totalSpent ?? 0)}`}
          subtitle={`${insights?.debitCount ?? 0} transactions`}
          loading={insightsLoading}
        />
        <Card
          label="Total Income"
          amount={formatCAD(insights?.totalIncome ?? 0)}
          subtitle={`${insights?.creditCount ?? 0} transactions`}
          loading={insightsLoading}
        />
        <Card
          label="Net Amount"
          amount={formatCAD(insights?.netAmount ?? 0)}
          subtitle="Income - Expenses"
          loading={insightsLoading}
        />
      </div>
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
        </YmFlex>
        {transactions && <TransactionsTable transactions={transactions} />}
      </Content>
    </>
  );
};

export default GroupDashboardPage;
