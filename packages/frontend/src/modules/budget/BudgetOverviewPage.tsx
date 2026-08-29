import { useMemo, useState } from 'react';
import Content from '@ui/Content/Content';
import YmMenu from '@ui/YmMenu/YmMenu';
import { MonthYearFilter } from '@/components/MonthYearFilter/MonthYearFilter';
import { InsightCards, InsightCardItem } from '@/components/InsightCards/InsightCards';
import CategoryRow from '@/components/CategoryRow/CategoryRow';
import CategoryModal from '@/components/CategoryModal/CategoryModal';
import { TRANSFER_PRIMARIES } from '@/components/AssignCategoryDialog/AssignCategoryDialog';
import {
  useGetBudgetSummaryQuery,
  useGetBudgetCategoriesQuery,
  useCreateBudgetCategoryMutation,
} from '@/services/budgetCategoryService';
import { useGetTransactionsQuery } from '@/services/transactionService';
import { formatCAD } from '@/utils/format';
import type { BudgetCategory, BudgetCategoryKind } from '@portfolio/common';
import styles from './BudgetOverviewPage.module.css';

const SECTIONS: { kind: BudgetCategoryKind; title: string }[] = [
  { kind: 'fixed', title: 'Fixed' },
  { kind: 'flexible', title: 'Flexible' },
  { kind: 'ignored', title: 'Not spending' },
];

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
        label: 'Planned',
        amount: `-${formatCAD(summary?.totalPlanned ?? 0)}`,
        subtitle: `${summary?.categories.length ?? 0} categories`,
      },
      {
        label: 'Actual',
        amount: `-${formatCAD(summary?.totalCost ?? 0)}`,
        subtitle: `${formatCAD(summary?.untagged.amount ?? 0)} untagged`,
      },
      {
        label: 'Money Left',
        amount: formatCAD(summary?.moneyLeft ?? 0),
        subtitle: 'After planned & spending',
      },
    ],
    [summary],
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

        {SECTIONS.map(section => {
          const rows = (summary?.categories ?? []).filter(
            c => c.kind === section.kind,
          );
          if (rows.length === 0) return null;
          return (
            <section key={section.kind} className={styles.section}>
              <h3 className={styles.sectionTitle}>{section.title}</h3>
              {rows.map(row => (
                <CategoryRow
                  key={row.categoryId}
                  summary={row}
                  month={selectedMonth}
                  year={selectedYear}
                  onEdit={openEdit}
                />
              ))}
            </section>
          );
        })}

        {summary && summary.untagged.transactionCount > 0 && (
          <div className={styles.untagged}>
            <span>Untagged</span>
            <span>
              {formatCAD(summary.untagged.amount)} ·{' '}
              {summary.untagged.transactionCount}{' '}
              {summary.untagged.transactionCount === 1
                ? 'transaction'
                : 'transactions'}
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
