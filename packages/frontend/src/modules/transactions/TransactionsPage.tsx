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
import { useGetBudgetQuery } from '@/services/budgetService';
import {
  useGetBudgetCategoriesQuery,
  useGetBudgetSummaryQuery,
} from '@/services/budgetCategoryService';
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
  // The income figure has to follow the toggle too, so it comes from the
  // budget summary — the one place that folds each member's salary override
  // over their base salary — rather than from `/budget`, which only ever
  // knows the caller's own salary.
  const { data: summary, isLoading: summaryLoading } = useGetBudgetSummaryQuery({
    month: selectedMonth,
    year: selectedYear,
    scope: effectiveScope,
  });
  // Still the caller's own salary: `Set Actual Income` edits your row, not
  // the household's.
  const { data: budget } = useGetBudgetQuery();
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

  const income = summary?.income ?? 0;
  const isActual = summary?.usingActualIncome ?? false;

  // Fixed categories are planned by the household and carry no per-member
  // split, so there is no honest "my share" to show one member. The Mine view
  // therefore hides the Fixed tile rather than showing a figure that belongs
  // to both of you; the money itself is not lost, since fixed charges are
  // counted as ordinary spending below.
  const isMine = effectiveScope === 'mine';
  // From the summary rather than the raw category list so a month-specific
  // planned override counts.
  const fixedCategories =
    summary?.categories.filter(c => c.kind === 'fixed') ?? [];
  const totalFixed = fixedCategories.reduce((sum, c) => sum + c.planned, 0);

  // Fixed expenses are counted as the transactions that actually landed, not
  // as their plan: `insights.totalSpent` already includes them, so nothing is
  // subtracted twice and an overrun costs what it really cost. The plan is
  // shown rather than spent — the Fixed tile reports how much of it has been
  // charged so far, which is what says "the rent is still coming" early in
  // the month.
  const spent = insights?.totalSpent ?? 0;
  const fixedSpent = insights?.fixedSpent ?? 0;
  const moneyLeft = income - spent;

  const loading = insightsLoading || summaryLoading;

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
      amount: `+${formatCAD(income)}`,
      note: isActual ? 'Actual for this month' : 'Projected',
    },
    {
      label: 'Spent',
      amount: formatCAD(spent),
      note: `${insights?.debitCount ?? 0} transactions`,
    },
    ...(isMine
      ? []
      : [
          {
            label: 'Fixed',
            amount: formatCAD(totalFixed),
            note: `${formatCAD(fixedSpent)} charged so far`,
          },
        ]),
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
