export type CategorySuggestionStatus = 'pending' | 'accepted' | 'rejected';

/** The transaction a suggestion is about, denormalised for the review table. */
export interface SuggestedTransactionSummary {
  id: string;
  description: string;
  subDescription?: string;
  amount: number;
  date: string;
  ownerName?: string;
  ownerEmail: string;
}

export interface CategorySuggestion {
  id: string;
  /** The category the suggester proposed. Never rewritten. */
  categoryId: string;
  /** 0..1. Displayed only; nothing branches on it. */
  confidence: number;
  reason: string;
  /** 'history' or 'claude'. */
  source: string;
  status: CategorySuggestionStatus;
  createdAt: number;
  transaction: SuggestedTransactionSummary;
}

export namespace CategorySuggestionPayloads {
  export interface Generate {
    month: number;
    year: number;
  }

  export interface GetMany {
    month: number;
    year: number;
  }

  export interface ResolveItem {
    id: string;
    action: 'accept' | 'reject';
    /** Overrides the proposed category on accept. Ignored on reject. */
    categoryId?: string;
  }

  export interface Resolve {
    items: ResolveItem[];
  }

  /** One entry per requested item, in request order. */
  export interface ResolveResult {
    id: string;
    ok: boolean;
    /** Present when `ok` is false. Safe to show to the user. */
    error?: string;
  }
}
