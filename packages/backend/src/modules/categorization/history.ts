import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { transactionCategories, transactions } from '../../db/schema';
import { normalizeDescription } from './normalize';
import type { Suggestion, SuggestibleTransaction } from './suggester';

export const HISTORY_REASON = 'Matched a previous tag for this merchant';

/**
 * The household's live tags, keyed by normalized description.
 *
 * Ordered newest first and inserted with `set` only when the key is absent,
 * so the most recent tag for a merchant is the one that wins.
 */
export const loadTagHistory = async (
  householdId: string,
  limit = 2000
): Promise<Map<string, string>> => {
  const rows = await db
    .select({
      description: transactions.description,
      categoryId: transactionCategories.categoryId,
    })
    .from(transactionCategories)
    .innerJoin(
      transactions,
      eq(transactions.id, transactionCategories.transactionId)
    )
    .where(
      and(
        eq(transactionCategories.householdId, householdId),
        isNull(transactionCategories.deletedAt)
      )
    )
    .orderBy(desc(transactionCategories.createdAt))
    .limit(limit);

  const history = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeDescription(row.description);
    if (key && !history.has(key)) history.set(key, row.categoryId);
  }
  return history;
};

/**
 * Splits candidates into those the household has already tagged under the
 * same normalized description and those that still need a model.
 *
 * Matching is exact. Fuzzy matching is deliberately absent: a wrong
 * deterministic match is worse than falling through to the model.
 */
export const matchHistory = (
  candidates: SuggestibleTransaction[],
  history: Map<string, string>
): { resolved: Suggestion[]; remaining: SuggestibleTransaction[] } => {
  const resolved: Suggestion[] = [];
  const remaining: SuggestibleTransaction[] = [];

  for (const txn of candidates) {
    const key = normalizeDescription(txn.description);
    const categoryId = key ? history.get(key) : undefined;
    if (categoryId) {
      resolved.push({
        transactionId: txn.id,
        categoryId,
        confidence: 1,
        reason: HISTORY_REASON,
      });
    } else {
      remaining.push(txn);
    }
  }

  return { resolved, remaining };
};
