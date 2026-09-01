import { useMemo, useState } from 'react';
import Content from '@ui/Content/Content';
import YmMenu from '@ui/YmMenu/YmMenu';
import { MonthYearFilter } from '@/components/MonthYearFilter/MonthYearFilter';
import { InsightCards, InsightCardItem } from '@/components/InsightCards/InsightCards';
import CategoryRow from '@/components/CategoryRow/CategoryRow';
import FixedRow from '@/components/FixedRow/FixedRow';
import CategoryModal from '@/components/CategoryModal/CategoryModal';
import { TRANSFER_PRIMARIES } from '@/components/AssignCategoryDialog/AssignCategoryDialog';
import {
  useGetBudgetSummaryQuery,
  useGetBudgetCategoriesQuery,
  useCreateBudgetCategoryMutation,
} from '@/services/budgetCategoryService';
import { useGetTransactionsQuery } from '@/services/transactionService';
import { formatCAD } from '@/utils/format';
import type { BudgetCategory } from '@portfolio/common';
import styles from './BudgetOverviewPage.module.css';

export const BudgetOverviewPage = () => {
  const now = new Date();
  const prevMonthIndex = (now.getMonth() + 11) % 12;
  const [selectedMonth, setSelectedMonth] = useState(prevMonthIndex + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetCategory | null>(null);

  const { data: summary, isLoading } = useGetBudgetSummaryQuery({
    month: selectedMonth,
    year: selectedYear,
  });
  const { data: categories } = useGetBudgetCategoriesQuery();
  const { data: monthTransactions } = useGetTransactionsQuery({
    month: selectedMonth,
    year: selectedYear,
  });
  const [createCategory] = useCreateBudgetCategoryMutation();

  // Offer a transfers category only when it would actually be useful: the user
  // has none, and this month holds untagged debits Plaid calls payments or
  // transfers. Nothing is auto-tagged — the user still assigns them.
  const hasIgnoredCategory = (categories ?? []).some(c => c.kind === 'ignored');
  const untaggedTransferCount = useMemo(
    () =>
      (monthTransactions ?? []).filter(
        t =>
          t.amount > 0 &&
          !t.categoryId &&
          !!t.category &&
          TRANSFER_PRIMARIES.includes(t.category),
      ).length,
    [monthTransactions],
  );

  // One pass over the month's categories feeds both the cards and the two
  // columns: fixed bills and "not spending" on the left, flexible on the right.
  const groups = useMemo(() => {
    const all = summary?.categories ?? [];
    const fixed = all.filter(c => c.kind === 'fixed');
    const flexible = all.filter(c => c.kind === 'flexible');
    return {
      fixed,
      flexible,
      ignored: all.filter(c => c.kind === 'ignored'),
      fixedPlanned: fixed.reduce((sum, c) => sum + c.planned, 0),
      fixedPaid: fixed.filter(c => c.transactionCount > 0).length,
      flexiblePlanned: flexible.reduce((sum, c) => sum + c.planned, 0),
      flexibleActual: flexible.reduce((sum, c) => sum + c.actual, 0),
    };
  }, [summary]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (categoryId: string) => {
    setEditing(categories?.find(c => c.id === categoryId) ?? null);
    setModalOpen(true);
  };

  const cards: InsightCardItem[] = useMemo(
    () => [
      {
        label: summary?.usingActualIncome ? 'Actual Income' : 'Projected Income',
        amount: `+${formatCAD(summary?.income ?? 0)}`,
        subtitle: summary?.usingActualIncome
          ? 'Actual for this month'
          : 'From your budget',
      },
      {
        label: 'Fixed',
        amount: `-${formatCAD(groups.fixedPlanned)}`,
        subtitle: `${groups.fixedPaid} of ${groups.fixed.length} paid`,
      },
      {
        label: 'Budgeted',
        amount: `-${formatCAD(groups.flexiblePlanned)}`,
        subtitle: `${formatCAD(groups.flexibleActual)} spent`,
      },
      {
        // Deliberately not summary.moneyLeft: that subtracts actual spending,
        // so it would not reconcile with the three cards beside it. Derived
        // from those two totals rather than totalPlanned so the row always
        // adds up on screen.
        label: 'Left',
        amount: formatCAD(
          (summary?.income ?? 0) - groups.fixedPlanned - groups.flexiblePlanned,
        ),
        subtitle: 'After fixed & budgeted',
      },
    ],
    [summary, groups],
  );

  return (
    <>
      <InsightCards cards={cards} loading={isLoading} />
      <Content>
        <MonthYearFilter
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        >
          <YmMenu
            ariaLabel="Budget actions"
            items={[{ label: 'New category', onClick: openCreate }]}
          />
        </MonthYearFilter>

        {summary && summary.categories.length === 0 && (
          <p className={styles.empty}>
            No categories yet. Create one to start planning where your money
            goes.
          </p>
        )}

        {!hasIgnoredCategory && untaggedTransferCount > 0 && (
          <div className={styles.prompt}>
            <span>
              {untaggedTransferCount}{' '}
              {untaggedTransferCount === 1 ? 'transaction looks' : 'transactions look'}{' '}
              like card payments or transfers. Those are not spending.
            </span>
            <button
              type="button"
              onClick={() =>
                createCategory({
                  name: 'Card payments & transfers',
                  kind: 'ignored',
                })
              }
            >
              Create a transfers category
            </button>
          </div>
        )}

        <div className={styles.columns}>
          <div className={styles.column}>
            {groups.fixed.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h3 className={styles.sectionTitle}>Fixed</h3>
                  <span className={styles.sectionTotal}>
                    {formatCAD(groups.fixedPlanned)} · {groups.fixedPaid} of{' '}
                    {groups.fixed.length}
                  </span>
                </div>
                {groups.fixed.map(row => (
                  <FixedRow
                    key={row.categoryId}
                    summary={row}
                    month={selectedMonth}
                    year={selectedYear}
                    onEdit={openEdit}
                  />
                ))}
              </section>
            )}

            {groups.ignored.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h3 className={styles.sectionTitle}>Not spending</h3>
                </div>
                {groups.ignored.map(row => (
                  <CategoryRow
                    key={row.categoryId}
                    summary={row}
                    month={selectedMonth}
                    year={selectedYear}
                    onEdit={openEdit}
                  />
                ))}
              </section>
            )}
          </div>

          <div className={styles.column}>
            {groups.flexible.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h3 className={styles.sectionTitle}>Categories</h3>
                  <span className={styles.sectionTotal}>
                    {formatCAD(groups.flexibleActual)} /{' '}
                    {formatCAD(groups.flexiblePlanned)}
                  </span>
                </div>
                {groups.flexible.map(row => (
                  <CategoryRow
                    key={row.categoryId}
                    summary={row}
                    month={selectedMonth}
                    year={selectedYear}
                    onEdit={openEdit}
                  />
                ))}
              </section>
            )}
          </div>
        </div>

        {summary && summary.untagged.transactionCount > 0 && (
          <div className={styles.prompt}>
            <span>
              {formatCAD(summary.untagged.amount)} across{' '}
              {summary.untagged.transactionCount}{' '}
              {summary.untagged.transactionCount === 1
                ? 'transaction is'
                : 'transactions are'}{' '}
              still untagged.
            </span>
          </div>
        )}
      </Content>

      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        category={editing}
      />
    </>
  );
};
