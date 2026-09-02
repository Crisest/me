import { useEffect, useMemo, useState } from 'react';
import YmDialog from '@ui/YmDialog/YmDialog';
import YmCombobox from '@ui/YmCombobox/YmCombobox';
import { useGetBudgetCategoriesQuery } from '@/services/budgetCategoryService';
import { useGetTransactionsQuery } from '@/services/transactionService';
import {
  useGenerateSuggestionsMutation,
  useGetSuggestionsQuery,
  useResolveSuggestionsMutation,
} from '@/services/categorizationService';
import { useAvailableCategories } from '@/hooks/useAvailableCategories';
import { formatCAD } from '@/utils/format';
import type { CategorySuggestionPayloads } from '@portfolio/common';
import styles from './ReviewSuggestionsDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  month: number;
  year: number;
};

const ReviewSuggestionsDialog: React.FC<Props> = ({
  open,
  onClose,
  month,
  year,
}) => {
  const [generate, { isLoading: isGenerating }] =
    useGenerateSuggestionsMutation();
  const [resolve, { isLoading: isResolving }] =
    useResolveSuggestionsMutation();
  const { data: suggestions, isFetching } = useGetSuggestionsQuery(
    { month, year },
    { skip: !open },
  );
  const { data: categories } = useGetBudgetCategoriesQuery();
  // Household scope, not the default 'mine': a suggestion run spans every
  // member, and a `fixed` category claimed by a partner's transaction must
  // still drop out of the picker. The backend already excludes it from the
  // offered list, so fetching only our own would offer an option that is
  // guaranteed to 409 on accept.
  const { data: transactions } = useGetTransactionsQuery(
    { month, year, scope: 'household' },
    { skip: !open },
  );

  /** categoryId chosen per suggestion; seeded from the suggestion itself. */
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});

  // A run with nothing new is a no-op that makes no API call, so generating
  // on every open is safe.
  useEffect(() => {
    if (open) generate({ month, year });
  }, [open, month, year, generate]);

  useEffect(() => {
    if (!suggestions) return;
    setChosen(prev => {
      const next = { ...prev };
      suggestions.forEach(s => {
        if (next[s.id] === undefined) next[s.id] = s.categoryId;
      });
      return next;
    });
  }, [suggestions]);

  const available = useAvailableCategories({ categories, transactions });

  const options = useMemo(
    () =>
      available.map(c => ({
        id: c.id,
        label: c.kind === 'ignored' ? `${c.name} — not spending` : c.name,
        value: c.id,
      })),
    [available],
  );

  const send = async (items: CategorySuggestionPayloads.ResolveItem[]) => {
    try {
      const results = await resolve({ month, year, items }).unwrap();
      setFailures(prev => {
        // Drop any stale failure for every item in this batch, then
        // reapply only the ones the server reports as failed again.
        const next = { ...prev };
        items.forEach(item => delete next[item.id]);
        results.forEach(r => {
          if (!r.ok) next[r.id] = r.error ?? 'Could not apply this suggestion';
        });
        return next;
      });
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      const message = apiErr?.data?.message ?? 'Could not apply suggestions';
      setFailures(prev => {
        const next = { ...prev };
        items.forEach(item => {
          next[item.id] = message;
        });
        return next;
      });
    }
  };

  const handleApplyAll = () =>
    send(
      (suggestions ?? []).map(s => ({
        id: s.id,
        action: 'accept' as const,
        categoryId: chosen[s.id] ?? s.categoryId,
      })),
    );

  const handleSkip = (id: string) => send([{ id, action: 'reject' }]);

  const handleClose = () => {
    setFailures({});
    onClose();
  };

  const busy = isGenerating || isFetching || isResolving;
  const isEmpty = !busy && (suggestions ?? []).length === 0;

  return (
    <YmDialog
      isOpen={open}
      onClose={handleClose}
      title="Review suggestions"
      footerButtonText="Apply"
      footerButtonAction={handleApplyAll}
      footerButtonDisabled={busy || isEmpty}
    >
      <div className={styles.body}>
        {busy && <div className={styles.status}>Working…</div>}

        {isEmpty && (
          <div className={styles.empty}>
            Everything in this month is categorized or skipped.
          </div>
        )}

        {!isEmpty &&
          (suggestions ?? []).map(s => (
            <div key={s.id} className={styles.row}>
              <div className={styles.transaction}>
                <div className={styles.description}>
                  {s.transaction.description}
                </div>
                <div className={styles.meta}>
                  {new Date(s.transaction.date).toLocaleDateString()} ·{' '}
                  {s.transaction.ownerName ?? s.transaction.ownerEmail}
                </div>
              </div>

              <div className={styles.amount}>
                {formatCAD(s.transaction.amount)}
              </div>

              <div className={styles.category}>
                <YmCombobox
                  options={options}
                  value={chosen[s.id] ?? s.categoryId}
                  onChange={value =>
                    setChosen(prev => ({ ...prev, [s.id]: value }))
                  }
                  placeholder="Choose a category"
                  ariaLabel={`Category for ${s.transaction.description}`}
                />
              </div>

              <div className={styles.reason}>
                {s.reason}
                <span className={styles.confidence}>
                  {Math.round(s.confidence * 100)}%
                </span>
              </div>

              <button
                type="button"
                className={styles.skip}
                onClick={() => handleSkip(s.id)}
                disabled={busy}
              >
                Skip
              </button>

              {failures[s.id] && (
                <div className={styles.error}>{failures[s.id]}</div>
              )}
            </div>
          ))}
      </div>
    </YmDialog>
  );
};

export default ReviewSuggestionsDialog;
