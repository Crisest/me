import type { BudgetSummary } from './BudgetCategory';

/**
 * A membership window as frozen into a snapshot.
 *
 * NOT the backend's `ScopeMember`, which carries `Date`s: JSON round-trips
 * those to ISO strings, so a `Date`-typed annotation would be a lie the
 * compiler could not catch.
 */
export interface SnapshotMember {
  userId: string;
  /** ISO 8601. */
  from: string;
  /** ISO 8601. null = still active at close time. */
  to: string | null;
}

/**
 * FROZEN TYPE. Instances are stored verbatim as jsonb in
 * `budget_month_snapshots.transactions`. May only ever GAIN OPTIONAL FIELDS —
 * see the same note on `BudgetSummary`.
 *
 * A rendering record and a recompute input, not a foreign key into a table
 * that may move. Category name and colour are deliberately absent: they live
 * once in `summary.categories[]`, keyed by `categoryId`. Duplicating them per
 * row invites the two copies to disagree.
 */
export interface SnapshotTransaction {
  /** The live transaction id, kept for provenance only. */
  id: string;
  /** ISO 8601. */
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail: string;
  cardName?: string;
  accountName?: string;
  accountMask?: string;
}

/** A closed month. Self-contained: rendering it consults no live state. */
export interface BudgetMonthSnapshot {
  id: string;
  householdId: string;
  month: number;
  year: number;
  /** Always 1 in the current scope. Incremented only by a future reopen. */
  version: number;
  members: SnapshotMember[];
  summary: BudgetSummary;
  transactions: SnapshotTransaction[];
  /** null when the closing user's account has since been deleted. */
  closedBy: string | null;
  /** Epoch ms. The close time — there is no separate `closedAt`. */
  closedAt: number;
  /** Epoch ms. Set when a later version replaced this one. */
  supersededAt?: number;
}

/** A member who has not filed actual income for the month. */
export interface MissingIncomeMember {
  userId: string;
  name?: string;
  email: string;
}

/** Why a month can or cannot be closed. Reported before anyone tries. */
export interface CloseReadiness {
  /** Untagged debits in the month. Must be 0. */
  untaggedCount: number;
  /** Members whose tenure covers the month and who filed no override. */
  membersMissingIncome: MissingIncomeMember[];
  /** untaggedCount === 0 && membersMissingIncome.length === 0 */
  canClose: boolean;
}

/** The close status of one month, reported alongside its summary. */
export interface MonthCloseState {
  closed: boolean;
  /** Present only when closed. */
  snapshotId?: string;
  /** Epoch ms. Present only when closed. */
  closedAt?: number;
  /** Present only when closed; null when that user's account is gone. */
  closedBy?: string | null;
  /**
   * Transactions created after the close time that fall inside the closed
   * month. Information only — they are never folded into the snapshot.
   * Always 0 for an open month.
   */
  lateTransactionCount: number;
  /** Always computed, closed or not, so the UI can explain either state. */
  readiness: CloseReadiness;
}

/**
 * The `GET /budget/summary` response body.
 *
 * `close` is present only for the household view. Closing is a household act,
 * so a `scope=mine` request omits it rather than paying for a second full
 * summary computation to answer a question that view does not ask.
 */
export interface BudgetSummaryResult {
  summary: BudgetSummary;
  close?: MonthCloseState;
}
