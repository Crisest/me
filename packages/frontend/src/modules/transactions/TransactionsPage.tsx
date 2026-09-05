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
import ReviewSuggestionsDialog from '@/components/ReviewSuggestionsDialog/ReviewSuggestionsDialog';
import PageHeader from '@ui/PageHeader/PageHeader';
import { SummaryCard, SummaryStat } from '@/components/SummaryCard/SummaryCard';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId') ?? undefined;

  // Seeded from the URL so a drilldown from the budget page opens on the
  // month it was viewing. Initial state only — the MonthYearFilter stays the
  // source of truth once the page is mounted, so changing the filter does
  // not fight a stale param.
  const monthParam = Number(searchParams.get('month'));
  const yearParam = Number(searchParams.get('year'));
  const [selectedMonth, setSelectedMonth] = useState(
    Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : previousMonth,
  );
  const [selectedYear, setSelectedYear] = useState(
    Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100
      ? yearParam
      : now.getFullYear(),
  );
  const [assignTxn, setAssignTxn] = useState<Transaction | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('newest');
  const [scope, setScope] = useState<Scope>('mine');

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
  const categoriesById = useMemo(
    () => new Map((categories ?? []).map(c => [c.id, c])),
    [categories],
  );
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

  const fixedCategories = categories?.filter(c => c.kind === 'fixed') ?? [];
  const totalFixed = fixedCategories.reduce(
    (sum, c) => sum + c.plannedAmount,
    0,
  );
  const remainingAfterFixed = effectiveSalary - totalFixed;
  const moneyLeft = remainingAfterFixed - (insights?.totalSpent ?? 0);

  const loading = insightsLoading || budgetLoading || overrideLoading;

  const selectedCategory = useMemo(
    () => (categoryId ? categoriesById.get(categoryId) : undefined),
    [categoriesById, categoryId],
  );

  const clearCategoryFilter = useCallback(() => {
    setSearchParams(params => {
      params.delete('categoryId');
      return params;
    });
  }, [setSearchParams]);

  const handleCategoryClick = useCallback(
    (clickedId: string) => {
      setSearchParams(params => {
        if (params.get('categoryId') === clickedId) params.delete('categoryId');
        else params.set('categoryId', clickedId);
        return params;
      });
    },
    [setSearchParams],
  );

  const rowActions = useCallback(
    (txn: Transaction) => {
      if (txn.amount <= 0) return [];
      if (txn.categoryId) {
        const category = categoriesById.get(txn.categoryId);
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
    [categoriesById, setCategory],
  );

  const stats: SummaryStat[] = [
    {
      label: isActual ? 'Actual income' : 'Income',
      amount: `+${formatCAD(effectiveSalary)}`,
      note: isActual ? 'Actual for this month' : 'Projected',
    },
    {
      label: 'Spent',
      amount: formatCAD(insights?.totalSpent ?? 0),
      note: `${insights?.debitCount ?? 0} transactions`,
    },
    {
      label: 'Fixed',
      amount: formatCAD(totalFixed),
      note: `${insights?.matchedFixedCount ?? 0} of ${fixedCategories.length} matched`,
    },
  ];

  return (
    <>
      <Content width="wide">
        <PageHeader title="Transactions">
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
              variant="bare"
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
                {
                  label: 'Upload CSV',
                  onClick: () => setOpenUploadModal(true),
                },
                {
                  label: 'Suggest categories',
                  onClick: () => setSuggestOpen(true),
                },
              ]}
            />
          </MonthYearFilter>
        </PageHeader>

        <SummaryCard
          label="Left to spend"
          amount={formatCAD(moneyLeft)}
          tone={moneyLeft < 0 ? 'negative' : 'positive'}
          variant="accent"
          stats={stats}
          loading={loading}
        />

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
              fontFamily: 'var(--font-family-body)',
              fontWeight: 700,
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
        {transactionsData && (
          <TransactionsTable
            transactions={filteredTransactions}
            extraColumns={isSharedHousehold ? ownerColumn : undefined}
            rowActions={rowActions}
            sortDirection={sortDirection}
            categoriesById={categoriesById}
            onCategoryClick={handleCategoryClick}
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
      <ReviewSuggestionsDialog
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
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
