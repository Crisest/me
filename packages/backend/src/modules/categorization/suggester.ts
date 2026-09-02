/** A transaction offered to a suggester. No database row types cross this line. */
export type SuggestibleTransaction = {
  id: string;
  description: string;
  /** Plaid personal-finance-category, detailed. */
  subDescription: string | null;
  /** Plaid personal-finance-category, primary. */
  plaidCategory: string | null;
  amount: number;
  date: Date;
};

export type SuggestibleCategory = {
  id: string;
  name: string;
  kind: 'fixed' | 'flexible' | 'ignored';
};

/** A description the household has already tagged, used as precedent. */
export type TaggedExample = {
  description: string;
  categoryId: string;
};

export type SuggestionInput = {
  transactions: SuggestibleTransaction[];
  categories: SuggestibleCategory[];
  examples: TaggedExample[];
};

export type Suggestion = {
  transactionId: string;
  categoryId: string;
  /** 0..1. Displayed to the user; never used to gate behaviour. */
  confidence: number;
  reason: string;
};

export interface CategorySuggester {
  /** Recorded on each persisted row as `source`. */
  readonly name: string;
  /**
   * Returns entries only for transactions it has an opinion about. An omitted
   * transaction simply gets no suggestion.
   */
  suggest(input: SuggestionInput): Promise<Suggestion[]>;
}
