import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import TransactionsTable, {
  SortDirection,
} from '@/components/TransactionsTable/TransactionsTable';
import { SortDirectionFilter } from '@/components/TransactionsTable/SortDirectionFilter';
import { ScopeToggle, Scope } from '@/components/ScopeToggle/ScopeToggle';
import YmMenu from '@ui/YmMenu/YmMenu';
import {
  useGetTransactionsQuery,
  useGetTransactionInsightsQuery,
  useSetTransactionCategoryMutation,
} from '@/services/transactionService';
import {
  useGetBudgetQuery,
  useGetBudgetOverrideQuery,
} from '@/services/budgetService';
import { useGetBudgetCategoriesQuery } from '@/services/budgetCategoryService';
import { useGetMyHouseholdQuery } from '@/services/householdService';
import ActualIncomeModal from '@/components/ActualIncomeModal/ActualIncomeModal';
import Content from '@ui/Content/Content';
import TransactionUploadModal from '@/components/TransactionUploadModal/TransactionUploadModal';
import BudgetModal from '@/components/BudgetModal/BudgetModal';
import AssignCategoryDialog from '@/components/AssignCategoryDialog/AssignCategoryDialog';
import {
  InsightCards,
  InsightCardItem,
} from '@/components/InsightCards/InsightCards';
import { MonthYearFilter } from '@/components/MonthYearFilter/MonthYearFilter';
import { formatCAD } from '@/utils/format';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { FaTimes } from 'react-icons/fa';
import type { Transaction } from '@portfolio/common';

const ownerColumn: ColumnDef<Transaction, any>[] = [
  {
    accessorKey: 'ownerName',
    header: 'User',
    cell: ({ row }) => row.original.ownerName || row.original.ownerEmail,
  },
];

export const TransactionsPage = () => {
  const now = new Date();
  const prevMonthIndex = (now.getMonth() + 11) % 12;
  const previousMonth = prevMonthIndex + 1;
  const [selectedMonth, setSelectedMonth] = useState(previousMonth);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [assignTxn, setAssignTxn] = useState<Transaction | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('newest');
  const [scope, setScope] = useState<Scope>('mine');
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId') ?? undefined;

  const { data: household } = useGetMyHouseholdQuery();
  const isSharedHousehold = (household?.members.length ?? 0) > 1;
  // `scope` persists as 'household' if the household drops back to solo
  // while the page is mounted (last other member leaves/removed) — the
  // toggle disappears with it, so derive the effective scope rather than
  // trusting the raw state. Both queries below must keep receiving the
  // SAME value so the insight cards and the table never disagree.
  const effectiveScope: Scope = isSharedHousehold ? scope : 'mine';

  const { data: transactionsData } = useGetTransactionsQuery({
    month: selectedMonth,
    year: selectedYear,
    categoryId,
    scope: effectiveScope,
  });
  const { data: insights, isLoading: insightsLoading } =
    useGetTransactionInsightsQuery({
      month: selectedMonth,
      year: selectedYear,
      scope: effectiveScope,
    });
  const { data: budget, isLoading: budgetLoading } = useGetBudgetQuery();
  const { data: override, isLoading: overrideLoading } =
    useGetBudgetOverrideQuery({ month: selectedMonth, year: selectedYear });
  const { data: categories } = useGetBudgetCategoriesQuery();
  const [setCategory] = useSetTransactionCategoryMutation();
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

  const fixedCategories =
    categories?.filter(c => c.kind === 'fixed') ?? [];
  const totalFixed = fixedCategories.reduce(
    (sum, c) => sum + c.plannedAmount,
    0,
  );
  const remainingAfterFixed = effectiveSalary - totalFixed;
  const moneyLeft = remainingAfterFixed - (insights?.totalSpent ?? 0);

  const loading = insightsLoading || budgetLoading || overrideLoading;

  const selectedCategory = useMemo(
    () => categories?.find(c => c.id === categoryId),
    [categories, categoryId],
  );

  const clearCategoryFilter = useCallback(() => {
    setSearchParams(params => {
      params.delete('categoryId');
      return params;
    });
  }, [setSearchParams]);

  const rowActions = useCallback(
    (txn: Transaction) => {
      if (txn.amount <= 0) return [];
      if (txn.categoryId) {
        const category = categories?.find(c => c.id === txn.categoryId);
        return [
          {
            label: `Remove from "${category?.name ?? 'category'}"`,
            onClick: () => setCategory({ id: txn.id, categoryId: null }),
          },
        ];
      }
      return [
        { label: 'Assign to category', onClick: () => setAssignTxn(txn) },
      ];
    },
    [categories, setCategory],
  );

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
      subtitle: `${fixedCategories.length} fixed expenses · ${insights?.matchedFixedCount ?? 0} matched`,
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
        {selectedCategory && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 6px 3px 10px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-blue-light)',
              color: 'var(--color-blue-dark)',
              fontSize: 'var(--font-xs)',
              fontFamily: 'var(--font-family-button)',
              marginBottom: '12px',
              width: 'fit-content',
            }}
          >
            {selectedCategory.name}
            <button
              type="button"
              aria-label={`Remove ${selectedCategory.name} filter`}
              onClick={clearCategoryFilter}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                padding: '2px',
              }}
            >
              <FaTimes />
            </button>
          </div>
        )}
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
          {isSharedHousehold && (
            <ScopeToggle value={effectiveScope} onChange={setScope} />
          )}
          <YmMenu
            ariaLabel="Budget actions"
            items={[
              {
                label: 'Set Monthly Income',
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
          <TransactionsTable
            transactions={filteredTransactions}
            extraColumns={isSharedHousehold ? ownerColumn : undefined}
            rowActions={rowActions}
            sortDirection={sortDirection}
          />
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
      <AssignCategoryDialog
        open={assignTxn !== null}
        onClose={() => setAssignTxn(null)}
        transaction={assignTxn}
        month={selectedMonth}
        year={selectedYear}
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
