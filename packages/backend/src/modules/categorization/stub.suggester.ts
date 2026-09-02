import type { CategorySuggester, Suggestion, SuggestionInput } from './suggester';

/**
 * Deterministic suggester for tests. Returns the canned suggestions whose
 * transaction was actually offered, and records every call so a test can
 * assert the chain skipped it entirely.
 */
export const createStubSuggester = (
  canned: Suggestion[]
): CategorySuggester & { calls: SuggestionInput[] } => {
  const calls: SuggestionInput[] = [];

  return {
    name: 'stub',
    calls,
    async suggest(input: SuggestionInput): Promise<Suggestion[]> {
      calls.push(input);
      const offered = new Set(input.transactions.map(t => t.id));
      return canned.filter(s => offered.has(s.transactionId));
    },
  };
};
