import type {
  BudgetSummary,
  CloseReadiness,
  MissingIncomeMember,
} from '@portfolio/common';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { memberCoversMonth } from './budgetSummary.service';

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
 * Precondition 2: every member whose tenure covers the month filed their OWN
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

  const membersMissingIncome: MissingIncomeMember[] = [];
  for (const member of scope.members) {
    if (!memberCoversMonth(member, month, year)) continue;
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
