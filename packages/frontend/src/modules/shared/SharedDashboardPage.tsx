import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { Transaction } from '@/types';
import {
  useGetGroupsQuery,
  useGetGroupTransactionsQuery,
  useGetGroupInsightsQuery,
} from '@/services/groupService';
import { useGetUserQuery } from '@/services/authService';
import { Route } from '@/enums/routerEnum';
import Header from '@/components/Header/Header';
import Content from '@ui/Content/Content';
import TransactionsTable, {
  SortDirection,
} from '@/components/TransactionsTable/TransactionsTable';
import { SortDirectionFilter } from '@/components/TransactionsTable/SortDirectionFilter';
import { InsightCards, InsightCardItem } from '@/components/InsightCards/InsightCards';
import { MonthYearFilter } from '@/components/MonthYearFilter/MonthYearFilter';
import { formatCAD } from '@/utils/format';
import { copyToClipboard } from '@/utils/clipboard';
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
  const [sortDirection, setSortDirection] = useState<SortDirection>('newest');

  const { data: me } = useGetUserQuery();
  const baseUrl = me?.config.appUrl ?? window.location.origin;

  const handleCopy = useCallback(
    async (inviteCode: string) => {
      const path = Route.SHARED_JOIN.replace(':code', inviteCode);
      const url = `${baseUrl}${path}`;
      try {
        await copyToClipboard(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy invite link', err);
      }
    },
    [baseUrl],
  );

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
          <SortDirectionFilter
            value={sortDirection}
            onChange={setSortDirection}
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
            sortDirection={sortDirection}
          />
        )}
      </Content>
    </>
  );
};

export default SharedDashboardPage;
