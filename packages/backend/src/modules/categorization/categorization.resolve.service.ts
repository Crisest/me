import { and, eq, isNull } from 'drizzle-orm';
import type { CategorySuggestionPayloads } from '@portfolio/common';
import { db } from '../../db/client';
import { categorySuggestions } from '../../db/schema';
import { AppError } from '../../middleware/errorHandler';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { setTransactionCategory } from '../transactions/transaction.service';

/**
 * Resolve one suggestion.
 *
 * Accept routes through `setTransactionCategory` rather than writing
 * `transaction_categories` directly, so the debit check, the
 * fixed-per-month check, the close-then-insert retag semantics, and the
 * category-ownership check all still apply. `category_id` on the suggestion
 * row is never rewritten: it records what was proposed, not what was chosen.
 */
const resolveOne = async (
  scope: BudgetScope,
  userId: string,
  item: CategorySuggestionPayloads.ResolveItem
): Promise<void> => {
  const [suggestion] = await db
    .select()
    .from(categorySuggestions)
    .where(
      and(
        eq(categorySuggestions.id, item.id),
        eq(categorySuggestions.householdId, scope.householdId),
        eq(categorySuggestions.status, 'pending'),
        isNull(categorySuggestions.deletedAt)
      )
    );

  if (!suggestion) {
    throw new AppError('Suggestion not found', 404);
  }

  if (item.action === 'reject') {
    await db
      .update(categorySuggestions)
      .set({ status: 'rejected', resolvedBy: userId, resolvedAt: new Date() })
      .where(eq(categorySuggestions.id, suggestion.id));
    return;
  }

  const categoryId = item.categoryId ?? suggestion.categoryId;

  await setTransactionCategory(scope, userId, suggestion.transactionId, {
    categoryId,
  });

  await db
    .update(categorySuggestions)
    .set({ status: 'accepted', resolvedBy: userId, resolvedAt: new Date() })
    .where(eq(categorySuggestions.id, suggestion.id));
};

/**
 * Per-item, never batched: one 409 from two accepts competing for the same
 * fixed category must not discard the other accepts.
 */
export const resolveSuggestions = async (
  scope: BudgetScope,
  userId: string,
  items: CategorySuggestionPayloads.ResolveItem[]
): Promise<CategorySuggestionPayloads.ResolveResult[]> => {
  const results: CategorySuggestionPayloads.ResolveResult[] = [];

  for (const item of items) {
    try {
      await resolveOne(scope, userId, item);
      results.push({ id: item.id, ok: true });
    } catch (err) {
      results.push({
        id: item.id,
        ok: false,
        error:
          err instanceof AppError ? err.message : 'Could not apply this suggestion',
      });
    }
  }

  return results;
};
