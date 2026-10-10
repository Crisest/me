import {
  matchToExisting,
  MATCH_DATE_WINDOW_MS,
  type MatchRow,
} from './transaction.matching';

const DAY = 24 * 60 * 60 * 1000;
const base = new Date('2026-03-10T00:00:00Z');
const at = (days: number): Date => new Date(base.getTime() + days * DAY);

const row = (over: Partial<MatchRow> = {}): MatchRow => ({
  accountId: 'a1',
  amount: 9.99,
  description: 'Coffee',
  date: base,
  ...over,
});
const ex = (
  id: string,
  over: Partial<MatchRow> = {}
): MatchRow & { id: string } => ({
  id,
  ...row(over),
});

describe('matchToExisting', () => {
  it('returns the id of an exact match', () => {
    expect(matchToExisting([row()], [ex('e1')])).toEqual(['e1']);
  });

  it('matches 3 days apart but not 4', () => {
    expect(MATCH_DATE_WINDOW_MS).toBe(3 * DAY);
    expect(matchToExisting([row({ date: at(3) })], [ex('e1')])).toEqual(['e1']);
    expect(matchToExisting([row({ date: at(4) })], [ex('e1')])).toEqual([null]);
  });

  it('compares amounts in cents', () => {
    expect(
      matchToExisting([row({ amount: 0.1 + 0.2 })], [ex('e1', { amount: 0.3 })])
    ).toEqual(['e1']);
    expect(matchToExisting([row({ amount: 9.98 })], [ex('e1')])).toEqual([
      null,
    ]);
  });

  it('does not match a different account', () => {
    expect(matchToExisting([row({ accountId: 'a2' })], [ex('e1')])).toEqual([
      null,
    ]);
  });

  it('never matches a null or undefined accountId', () => {
    expect(
      matchToExisting(
        [row({ accountId: null }), row({ accountId: undefined })],
        [ex('e1', { accountId: null }), ex('e2', { accountId: undefined })]
      )
    ).toEqual([null, null]);
  });

  it('matches two identical rows against two existing rows', () => {
    expect(
      matchToExisting([row(), row()], [ex('e1'), ex('e2')]).sort()
    ).toEqual(['e1', 'e2']);
  });

  it('claims an existing row only once', () => {
    expect(matchToExisting([row(), row()], [ex('e1')])).toEqual(['e1', null]);
  });

  it('prefers an equal description over an equally distant date', () => {
    const existing = [
      ex('other', { description: 'Tims', date: at(-1) }),
      ex('same', { description: '  COFFEE ', date: at(1) }),
    ];
    expect(matchToExisting([row()], existing)).toEqual(['same']);
  });

  it('prefers the closest date when descriptions do not match', () => {
    const existing = [
      ex('far', { description: 'x', date: at(2) }),
      ex('near', { description: 'y', date: at(1) }),
    ];
    expect(matchToExisting([row()], existing)).toEqual(['near']);
  });
});
