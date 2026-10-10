import type {
  BudgetSummary,
  CloseReadiness,
  MissingIncomeMember,
  MonthCloseState,
} from '@portfolio/common';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import type { BudgetMonthSnapshotRow } from '../../db/schema';
import { db } from '../../db/client';
import { AppError } from '../../middleware/errorHandler';
import { memberCoversMonth, getBudgetSummary } from './budgetSummary.service';
import {
  countLateTransactions,
  getLiveSnapshot,
  insertSnapshot,
  listSnapshotTransactions,
} from './monthSnapshot.service';

/**
 * Whether a month can be filed, and what is stopping it.
 *
 * Pure — it reads only the summary it is handed and the scope's tenure
 * windows. Reported on the summary response so both members see the blockers
 * before anyone clicks Close: an error at click time is discovered alone by
 * whoever happened to click, which is too late to force the reconciliation
 * conversation the preconditions exist for.
 *
 * Precondition 1: every debit in the month is categorised. The untagged bucket
 * already filters `amount > 0`, so its count IS the number of untagged debits.
 *
 * Precondition 2: every member still in the household at month end (tenure
 * covers the month and has not closed before it ended) filed their OWN
 * actual income. `usingActualIncome` cannot answer this — it is an any-member
 * OR — so this reads `byMember[].isActual` per member. One member cannot close
 * on another's behalf.
 */
export const getCloseReadiness = (
  summary: BudgetSummary,
  scope: BudgetScope,
  month: number,
  year: number
): CloseReadiness => {
  const untaggedCount = summary.untagged.transactionCount;

  const incomeByUser = new Map(
    (summary.byMember ?? []).map(m => [m.userId, m])
  );

  const monthEnd = new Date(year, month, 1);
  const membersMissingIncome: MissingIncomeMember[] = [];
  for (const member of scope.members) {
    if (!memberCoversMonth(member, month, year)) continue;
    // Left before the month ended: their income still counts in the totals,
    // but they can no longer file it, so they must not block the close. A
    // member who rejoined has a second, open window and is still checked.
    if (member.to && member.to < monthEnd) continue;
    if (membersMissingIncome.some(m => m.userId === member.userId)) continue;
    const income = incomeByUser.get(member.userId);
    if (income?.isActual) continue;
    membersMissingIncome.push({
      userId: member.userId,
      email: income?.email ?? '',
      ...(income?.name ? { name: income.name } : {}),
    });
  }

  return {
    untaggedCount,
    membersMissingIncome,
    canClose: untaggedCount === 0 && membersMissingIncome.length === 0,
  };
};

/** Human-readable reason a month cannot be filed yet. */
const describeBlockers = (readiness: CloseReadiness): string => {
  const parts: string[] = [];
  if (readiness.untaggedCount > 0) {
    parts.push(
      `${readiness.untaggedCount} ${
        readiness.untaggedCount === 1 ? 'transaction is' : 'transactions are'
      } untagged`
    );
  }
  for (const member of readiness.membersMissingIncome) {
    parts.push(`waiting on ${member.name ?? member.email}'s income`);
  }
  return parts.join(' · ');
};

/**
 * Files a month.
 *
 * Both reads and the insert run in ONE database transaction, so a transaction
 * landing mid-close cannot produce a snapshot whose rows and totals disagree
 * at birth.
 *
 * Household-scoped on both sides, explicitly. The live defaults disagree —
 * `getSummary` defaults to household while `getAllTransactions` defaults to
 * `mine` — so a snapshot built by inheriting them would freeze a household
 * summary beside one person's rows. Neither default is relied on here.
 *
 * Idempotent by constraint: the partial unique index rejects a second live
 * snapshot for the same month, which the error handler maps to a 409.
 */
export const closeMonth = async (
  scope: BudgetScope,
  userId: string,
  month: number,
  year: number
): Promise<BudgetMonthSnapshotRow> =>
  db.transaction(async tx => {
    const existing = await getLiveSnapshot(scope.householdId, month, year, tx);
    if (existing) {
      throw new AppError('This month is already closed', 409);
    }

    // memberId omitted on purpose: a snapshot is always the household's.
    const summary = await getBudgetSummary(scope, month, year, undefined, tx);

    // The endpoint is the authority even though the UI should never have let
    // it get here.
    const readiness = getCloseReadiness(summary, scope, month, year);
    if (!readiness.canClose) {
      throw new AppError(
        `This month is not ready to close: ${describeBlockers(readiness)}`,
        400
      );
    }

    const transactions = await listSnapshotTransactions(scope, month, year, tx);

    return insertSnapshot(
      { scope, month, year, summary, transactions, closedBy: userId },
      tx
    );
  });

/**
 * The close status of a month, reported alongside its summary.
 *
 * Readiness is computed whether the month is open or closed, so the UI can
 * explain either state from one payload.
 */
export const getMonthCloseState = async (
  scope: BudgetScope,
  summary: BudgetSummary,
  month: number,
  year: number
): Promise<MonthCloseState> => {
  const snapshot = await getLiveSnapshot(scope.householdId, month, year);
  const readiness = getCloseReadiness(summary, scope, month, year);

  if (!snapshot) {
    return { closed: false, lateTransactionCount: 0, readiness };
  }

  return {
    closed: true,
    snapshotId: snapshot.id,
    closedAt: snapshot.createdAt.getTime(),
    closedBy: snapshot.closedBy,
    lateTransactionCount: await countLateTransactions(
      scope,
      month,
      year,
      snapshot.createdAt
    ),
    // A closed month's frozen summary has nothing untagged and every member
    // marked actual, so `canClose` would otherwise compute true — reading as
    // "go ahead and close it" for a month that is already closed. Callers
    // must not have to check `closed` first to interpret `canClose`.
    readiness: { ...readiness, canClose: false },
  };
};
