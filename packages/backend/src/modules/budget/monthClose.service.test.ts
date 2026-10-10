import type { BudgetSummary } from '@portfolio/common';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { getCloseReadiness } from './monthClose.service';

const scope = (members: BudgetScope['members']): BudgetScope => ({
  householdId: 'h1',
  members,
});

const ALWAYS = { from: new Date('2000-01-01'), to: null };

const summaryWith = (over: Partial<BudgetSummary>): BudgetSummary => ({
  month: 3,
  year: 2026,
  income: 5000,
  usingActualIncome: true,
  byMember: [],
  categories: [],
  untagged: { amount: 0, transactionCount: 0, byMember: [] },
  totalPlanned: 0,
  totalCost: 0,
  moneyLeft: 5000,
  ...over,
});

describe('getCloseReadiness', () => {
  it('is ready when nothing is untagged and everyone has filed', () => {
    const summary = summaryWith({
      byMember: [
        { userId: 'u1', email: 'a@x.com', amount: 5000, isActual: true },
      ],
    });

    const readiness = getCloseReadiness(
      summary,
      scope([{ userId: 'u1', ...ALWAYS }]),
      3,
      2026
    );

    expect(readiness).toEqual({
      untaggedCount: 0,
      membersMissingIncome: [],
      canClose: true,
    });
  });

  it('blocks on untagged transactions', () => {
    const summary = summaryWith({
      byMember: [
        { userId: 'u1', email: 'a@x.com', amount: 5000, isActual: true },
      ],
      untagged: { amount: 40, transactionCount: 2, byMember: [] },
    });

    const readiness = getCloseReadiness(
      summary,
      scope([{ userId: 'u1', ...ALWAYS }]),
      3,
      2026
    );

    expect(readiness.untaggedCount).toBe(2);
    expect(readiness.canClose).toBe(false);
  });

  it('blocks on a member who fell back to their base salary', () => {
    // usingActualIncome is true here — the any-member OR. Readiness must not
    // be fooled by it.
    const summary = summaryWith({
      byMember: [
        { userId: 'u1', email: 'a@x.com', amount: 5000, isActual: true },
        {
          userId: 'u2',
          email: 'b@x.com',
          name: 'Bo',
          amount: 3000,
          isActual: false,
        },
      ],
    });

    const readiness = getCloseReadiness(
      summary,
      scope([
        { userId: 'u1', ...ALWAYS },
        { userId: 'u2', ...ALWAYS },
      ]),
      3,
      2026
    );

    expect(readiness.membersMissingIncome).toEqual([
      { userId: 'u2', email: 'b@x.com', name: 'Bo' },
    ]);
    expect(readiness.canClose).toBe(false);
  });

  it('blocks on a covering member missing from byMember entirely', () => {
    const summary = summaryWith({ byMember: [] });

    const readiness = getCloseReadiness(
      summary,
      scope([{ userId: 'u1', ...ALWAYS }]),
      3,
      2026
    );

    expect(readiness.membersMissingIncome).toEqual([
      { userId: 'u1', email: '' },
    ]);
    expect(readiness.canClose).toBe(false);
  });

  it('does not require income from someone who joined after the month', () => {
    // Membership is tenure-windowed: someone who joined in June is not
    // required to file income for March.
    const summary = summaryWith({
      byMember: [
        { userId: 'u1', email: 'a@x.com', amount: 5000, isActual: true },
      ],
    });

    const readiness = getCloseReadiness(
      summary,
      scope([
        { userId: 'u1', ...ALWAYS },
        { userId: 'u2', from: new Date('2026-06-01'), to: null },
      ]),
      3,
      2026
    );

    expect(readiness.membersMissingIncome).toEqual([]);
    expect(readiness.canClose).toBe(true);
  });

  it('does not require income from someone who left mid-month', () => {
    // They overlap the month, so their income is still counted — but they can
    // no longer file it, so they must not block the close.
    const summary = summaryWith({
      byMember: [
        { userId: 'u1', email: 'a@x.com', amount: 5000, isActual: true },
        { userId: 'u2', email: 'b@x.com', amount: 3000, isActual: false },
      ],
    });

    const readiness = getCloseReadiness(
      summary,
      scope([
        { userId: 'u1', ...ALWAYS },
        { userId: 'u2', from: new Date('2000-01-01'), to: new Date('2026-03-08') },
      ]),
      3,
      2026
    );

    expect(readiness.membersMissingIncome).toEqual([]);
    expect(readiness.canClose).toBe(true);
  });

  it('still requires income from someone who left and rejoined', () => {
    const summary = summaryWith({
      byMember: [
        { userId: 'u1', email: 'a@x.com', amount: 5000, isActual: true },
        { userId: 'u2', email: 'b@x.com', amount: 3000, isActual: false },
      ],
    });

    const readiness = getCloseReadiness(
      summary,
      scope([
        { userId: 'u1', ...ALWAYS },
        { userId: 'u2', from: new Date('2000-01-01'), to: new Date('2026-03-08') },
        { userId: 'u2', from: new Date('2026-03-20'), to: null },
      ]),
      3,
      2026
    );

    expect(readiness.membersMissingIncome).toEqual([
      { userId: 'u2', email: 'b@x.com' },
    ]);
    expect(readiness.canClose).toBe(false);
  });

  it('reports both blockers at once', () => {
    const summary = summaryWith({
      byMember: [
        { userId: 'u1', email: 'a@x.com', amount: 5000, isActual: false },
      ],
      untagged: { amount: 40, transactionCount: 2, byMember: [] },
    });

    const readiness = getCloseReadiness(
      summary,
      scope([{ userId: 'u1', ...ALWAYS }]),
      3,
      2026
    );

    expect(readiness.untaggedCount).toBe(2);
    expect(readiness.membersMissingIncome).toHaveLength(1);
    expect(readiness.canClose).toBe(false);
  });
});
