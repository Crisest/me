import { useRef, useState, useEffect, useCallback } from 'react';
import { Card } from '@/ui/Card/Card';
import styles from './InsightCards.module.css';

export interface InsightCardItem {
  label: string;
  amount: string;
  subtitle: string;
}

interface InsightCardsProps {
  cards: InsightCardItem[];
  loading?: boolean;
}

export function InsightCards({ cards, loading }: InsightCardsProps) {
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
        {cards.map(card => (
          <Card
            key={card.label}
            label={card.label}
            amount={card.amount}
            subtitle={card.subtitle}
            loading={loading}
          />
        ))}
      </div>
      <div
        className={`${styles.blurRight} ${canScrollRight ? styles.blurVisible : ''}`}
      />
    </div>
  );
}
