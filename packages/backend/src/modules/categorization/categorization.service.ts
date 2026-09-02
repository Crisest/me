import { and, eq, gt, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { CategorySuggestion } from '@portfolio/common';
import { db } from '../../db/client';
import {
  budgetCategories,
  categorySuggestions,
  transactionCategories,
  transactions,
  users,
} from '../../db/schema';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import logger from '../../utils/logger';
import { householdOwnerFilter } from '../shared/householdScope';
import { toCategorySuggestion } from './categorization.mapper';
import { loadTagHistory, matchHistory } from './history';
import { resolveSuggester } from './claude.suggester';
import type {
  CategorySuggester,
  Suggestion,
  SuggestibleTransaction,
} from './suggester';

type MonthParams = { month: number; year: number };

const monthBounds = ({ month, year }: MonthParams) => ({
  startDate: new Date(Date.UTC(year, month - 1, 1)),
  endDate: new Date(Date.UTC(year, month, 1)),
});

/**
 * Untagged household debits in the month that do not already have a live
 * suggestion row.
 *
 * That single "no live suggestion" condition is what makes a re-run a no-op:
 * a pending row means the answer already exists, and a rejected row means the
 * user skipped it deliberately.
 */
const loadCandidates = async (
  scope: BudgetScope,
  params: MonthParams
): Promise<SuggestibleTransaction[]> => {
  const ownerFilter = householdOwnerFilter(scope.members);
  if (!ownerFilter) return [];
  const { startDate, endDate } = monthBounds(params);

  const rows = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      subDescription: transactions.subDescription,
      plaidCategory: transactions.category,
      amount: transactions.amount,
      date: transactions.date,
    })
    .from(transactions)
    .where(
      and(
        ownerFilter,
        gte(transactions.date, startDate),
        lt(transactions.date, endDate),
        gt(transactions.amount, 0),
        sql`NOT EXISTS (
          SELECT 1 FROM transaction_categories tc
          WHERE tc.transaction_id = ${transactions.id}
            AND tc.household_id = ${scope.householdId}
            AND tc.deleted_at IS NULL
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM category_suggestions cs
          WHERE cs.transaction_id = ${transactions.id}
            AND cs.household_id = ${scope.householdId}
            AND cs.deleted_at IS NULL
        )`
      )
    );

  return rows;
};

/**
 * The household's live categories, minus any `fixed` category a transaction in
 * this month already holds. Enforcing constraint 3 here means most accepts
 * cannot 409.
 */
const loadOfferableCategories = async (
  scope: BudgetScope,
  params: MonthParams
) => {
  const { startDate, endDate } = monthBounds(params);

  const all = await db
    .select({
      id: budgetCategories.id,
      name: budgetCategories.name,
      kind: budgetCategories.kind,
    })
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.householdId, scope.householdId),
        isNull(budgetCategories.deletedAt)
      )
    );

  const claimed = await db
    .select({ categoryId: transactionCategories.categoryId })
    .from(transactionCategories)
    .innerJoin(
      transactions,
      eq(transactions.id, transactionCategories.transactionId)
    )
    .where(
      and(
        eq(transactionCategories.householdId, scope.householdId),
        isNull(transactionCategories.deletedAt),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    );

  const claimedIds = new Set(claimed.map(c => c.categoryId));
  return all.filter(c => c.kind !== 'fixed' || !claimedIds.has(c.id));
};

/** Reads back rows joined for the DTO. */
const loadSuggestionDtos = async (
  householdId: string,
  suggestionIds: string[]
): Promise<CategorySuggestion[]> => {
  if (suggestionIds.length === 0) return [];

  const rows = await db
    .select({
      suggestion: categorySuggestions,
      txnId: transactions.id,
      description: transactions.description,
      subDescription: transactions.subDescription,
      amount: transactions.amount,
      date: transactions.date,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(categorySuggestions)
    .innerJoin(transactions, eq(transactions.id, categorySuggestions.transactionId))
    .innerJoin(users, eq(users.id, transactions.createdBy))
    .where(
      and(
        eq(categorySuggestions.householdId, householdId),
        inArray(categorySuggestions.id, suggestionIds)
      )
    );

  return rows.map(r =>
    toCategorySuggestion(r.suggestion, {
      id: r.txnId,
      description: r.description,
      subDescription: r.subDescription,
      amount: r.amount,
      date: r.date,
      ownerName: r.ownerName,
      ownerEmail: r.ownerEmail,
    })
  );
};

export const generateSuggestions = async (
  scope: BudgetScope,
  userId: string,
  params: MonthParams,
  suggester: CategorySuggester | undefined = resolveSuggester()
): Promise<CategorySuggestion[]> => {
  const candidates = await loadCandidates(scope, params);
  if (candidates.length === 0) return [];

  const categories = await loadOfferableCategories(scope, params);
  if (categories.length === 0) return [];

  const history = await loadTagHistory(scope.householdId);
  const { resolved, remaining } = matchHistory(candidates, history);

  const examples = [...history.entries()]
    .slice(0, 100)
    .map(([description, categoryId]) => ({ description, categoryId }));

  let modelSuggestions: Suggestion[] = [];
  if (suggester && remaining.length > 0) {
    modelSuggestions = await suggester.suggest({
      transactions: remaining,
      categories,
      examples,
    });
  }

  // A suggester's output is untrusted: an unrecognised uuid would hit the
  // `restrict` foreign key. Validate before anything reaches the database.
  const candidateIds = new Set(candidates.map(c => c.id));
  const categoryIds = new Set(categories.map(c => c.id));
  const tagged = [
    ...resolved.map(s => ({ suggestion: s, source: 'history' })),
    ...modelSuggestions.map(s => ({ suggestion: s, source: suggester!.name })),
  ];

  const valid = tagged.filter(({ suggestion }) => {
    const ok =
      candidateIds.has(suggestion.transactionId) &&
      categoryIds.has(suggestion.categoryId);
    if (!ok) {
      logger.warn(
        {
          transactionId: suggestion.transactionId,
          categoryId: suggestion.categoryId,
        },
        'dropped unrecognised suggestion'
      );
    }
    return ok;
  });

  if (valid.length === 0) return [];

  const inserted = await db.transaction(async tx =>
    tx
      .insert(categorySuggestions)
      .values(
        valid.map(({ suggestion, source }) => ({
          transactionId: suggestion.transactionId,
          householdId: scope.householdId,
          categoryId: suggestion.categoryId,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
          source,
          createdBy: userId,
        }))
      )
      .returning({ id: categorySuggestions.id })
  );

  return loadSuggestionDtos(
    scope.householdId,
    inserted.map(r => r.id)
  );
};

export const getPendingSuggestions = async (
  scope: BudgetScope,
  params: MonthParams
): Promise<CategorySuggestion[]> => {
  const { startDate, endDate } = monthBounds(params);

  const rows = await db
    .select({ id: categorySuggestions.id })
    .from(categorySuggestions)
    .innerJoin(transactions, eq(transactions.id, categorySuggestions.transactionId))
    .where(
      and(
        eq(categorySuggestions.householdId, scope.householdId),
        eq(categorySuggestions.status, 'pending'),
        isNull(categorySuggestions.deletedAt),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    );

  return loadSuggestionDtos(
    scope.householdId,
    rows.map(r => r.id)
  );
};
