import { useRef, useState, useEffect, useCallback } from 'react';
import { useGetTransactionInsightsQuery } from '@/services/transactionService';
import { useGetBudgetQuery } from '@/services/budgetService';
import { Card } from '@/ui/Card/Card';
import styles from './InsightCards.module.css';

interface InsightCardsProps {
  month: number;
  year: number;
}

function formatCAD(amount: number): string {
  return amount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export function InsightCards({ month, year }: InsightCardsProps) {
  const { data, isLoading } = useGetTransactionInsightsQuery({ month, year });
  const { data: budget, isLoading: budgetLoading } = useGetBudgetQuery();

  const totalFixed =
    budget?.fixedExpenses.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const remainingAfterFixed = (budget?.salary ?? 0) - totalFixed;
  const moneyLeft = remainingAfterFixed - (data?.totalSpent ?? 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  return (
    <div className={styles.container}>
      <div
        className={`${styles.blurLeft} ${canScrollLeft ? styles.blurVisible : ''}`}
      />
      <div className={styles.scrollArea} ref={scrollRef}>
        <Card
          label="Budget"
          amount={`+${formatCAD(8000)}`}
          subtitle={`${data?.debitCount ?? 0} transactions`}
          loading={isLoading}
        />
        <Card
          label="Total Spent"
          amount={`-${formatCAD(data?.totalSpent ?? 0)}`}
          subtitle={`${data?.debitCount ?? 0} transactions`}
          loading={isLoading}
        />
        {/* <Card
          label="Total Income"
          amount={formatCAD(data?.totalIncome ?? 0)}
          subtitle={`${data?.creditCount ?? 0} transactions`}
          loading={isLoading} 
        />
        {/* <Card
          label="Net Amount"
          amount={formatCAD(data?.netAmount ?? 0)}
          subtitle="Income − Expenses"
          loading={isLoading}
        /> */}
        <Card
          label="Fixed Expenses"
          amount={`-${formatCAD(totalFixed)}`}
          subtitle={`${budget?.fixedExpenses.length ?? 0} fixed expenses`}
          loading={isLoading || budgetLoading}
        />
        <Card
          label="Money Left"
          amount={formatCAD(moneyLeft)}
          subtitle="After fixed & spending"
          loading={isLoading || budgetLoading}
        />
      </div>
      <div
        className={`${styles.blurRight} ${canScrollRight ? styles.blurVisible : ''}`}
      />
    </div>
  );
}
