import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { Transaction } from '@/types';
import {
  useGetGroupsQuery,
  useGetGroupTransactionsQuery,
  useGetGroupInsightsQuery,
} from '@/services/groupService';
import Header from '@/components/Header/Header';
import Content from '@ui/Content/Content';
import TransactionsTable from '@/components/TransactionsTable/TransactionsTable';
import { InsightCards, InsightCardItem } from '@/components/InsightCards/InsightCards';
import { MonthYearFilter } from '@/components/MonthYearFilter/MonthYearFilter';
import { formatCAD } from '@/utils/format';
import YButton from '@/ui/Button/Button';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { FaRegCopy } from 'react-icons/fa';

const groupExtraColumns: ColumnDef<Transaction, any>[] = [
  {
    accessorKey: 'ownerName',
    header: 'User',
    cell: ({ row }) => row.original.ownerName || row.original.ownerEmail || '—',
  },
];

const SharedDashboardPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const now = new Date();
  const prevMonthIndex = (now.getMonth() + 11) % 12;
  const previousMonth = prevMonthIndex + 1;
  const [selectedMonth, setSelectedMonth] = useState(previousMonth);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((inviteCode: string) => {
    const url = `${window.location.origin}/shared/join/${inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const { data: groups = [] } = useGetGroupsQuery();
  const group = groups.find(g => g.id === groupId);

  const { data: transactions } = useGetGroupTransactionsQuery(
    { groupId: groupId!, month: selectedMonth, year: selectedYear },
    { skip: !groupId },
  );

  const { data: insights, isLoading: insightsLoading } =
    useGetGroupInsightsQuery(
      { groupId: groupId!, month: selectedMonth, year: selectedYear },
      { skip: !groupId },
    );

  const cards: InsightCardItem[] = [
    {
      label: 'Budget',
      amount: `+${formatCAD(insights?.budget ?? 0)}`,
      subtitle: 'Combined monthly budget',
    },
    {
      label: 'Total Spent',
      amount: `-${formatCAD(insights?.totalSpent ?? 0)}`,
      subtitle: `${insights?.debitCount ?? 0} transactions`,
    },
    {
      label: 'Fixed Expenses',
      amount: `-${formatCAD(insights?.totalFixed ?? 0)}`,
      subtitle: `${insights?.fixedCount ?? 0} fixed expenses`,
    },
    {
      label: 'Money Left',
      amount: formatCAD(insights?.moneyLeft ?? 0),
      subtitle: 'After fixed & spending',
    },
  ];

  const {
    options: accountOptions,
    selectedAccountId,
    setSelectedAccountId,
    filteredTransactions,
  } = useAccountFilter(transactions);

  return (
    <>
      <Header title={group?.name ?? 'Shared'} />
      <InsightCards cards={cards} loading={insightsLoading} />
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
          {group?.inviteCode && (
            <YButton onClick={() => handleCopy(group.inviteCode)}>
              {copied ? 'Copied!' : 'Copy invite link'} <FaRegCopy />
            </YButton>
          )}
        </MonthYearFilter>
        {transactions && (
          <TransactionsTable
            transactions={filteredTransactions}
            extraColumns={groupExtraColumns}
          />
        )}
      </Content>
    </>
  );
};

export default SharedDashboardPage;
