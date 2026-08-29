import { checkOrphans, checkUnknownFields, checkPrecision, checkMembershipDrift } from './audit';

describe('audit checks', () => {
  it('flags an orphaned required reference as halt', () => {
    const findings = checkOrphans(
      'transactions',
      [{ _id: 't1', createdBy: 'missing-user' }],
      { createdBy: { ids: new Set(['real-user']), required: true } }
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('orphan-required');
    expect(findings[0].severity).toBe('halt');
  });

  it('flags an orphaned optional reference as resolvable', () => {
    const findings = checkOrphans(
      'transactions',
      [{ _id: 't1', cardId: 'missing-card' }],
      { cardId: { ids: new Set(['real-card']), required: false } }
    );
    expect(findings[0].kind).toBe('orphan-optional');
    expect(findings[0].severity).toBe('resolve');
  });

  it('passes when every reference resolves', () => {
    expect(
      checkOrphans(
        'cards',
        [{ _id: 'c1', bankId: 'b1' }],
        { bankId: { ids: new Set(['b1']), required: true } }
      )
    ).toEqual([]);
  });

  it('flags legacy fields the target schema does not model', () => {
    const findings = checkUnknownFields('budgets', [
      { _id: 'b1', salary: 100, createdBy: 'u1', retiredField: 'x' },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('unknown-field');
    expect(findings[0].detail).toContain('retiredField');
    expect(findings[0].severity).toBe('halt');
  });

  // fixedExpenses is not an unmapped field: the loader turns each entry into a
  // budget_categories row, so flagging it would halt a load that loses nothing.
  it('does not flag fixedExpenses, which the loader maps to categories', () => {
    expect(
      checkUnknownFields('budgets', [
        {
          _id: 'b1',
          salary: 100,
          createdBy: 'u1',
          fixedExpenses: [{ _id: 'f1', name: 'Rent', amount: 3300 }],
        },
      ])
    ).toEqual([]);
  });

  it('flags money that numeric(12,2) would round', () => {
    const findings = checkPrecision('transactions', 'amount', [
      { _id: 't1', amount: 10.555 },
      { _id: 't2', amount: 10.55 },
      { _id: 't3', amount: 99999999999.99 },
    ]);
    const ids = findings.map(f => f.documentId);
    expect(ids).toContain('t1');
    expect(ids).toContain('t3');
    expect(ids).not.toContain('t2');
    expect(findings.every(f => f.severity === 'halt')).toBe(true);
  });

  it('reports each membership disagreement individually', () => {
    const findings = checkMembershipDrift(
      [{ _id: 'g1', members: ['u1', 'u2'] }],
      [
        { _id: 'u1', groups: ['g1'] },
        { _id: 'u2', groups: [] },
        { _id: 'u3', groups: ['g1'] },
      ]
    );
    const details = findings.map(f => f.detail).join(' | ');
    // u2 is in the group array but not the user array
    expect(details).toContain('u2');
    // u3 claims membership the group does not list
    expect(details).toContain('u3');
    expect(findings.every(f => f.kind === 'membership-drift')).toBe(true);
  });

  // The loader unions both arrays, so drift costs nothing and must not block
  // the load — otherwise a dataset with drift can never be migrated at all.
  it('reports drift as informational, never as blocking', () => {
    const findings = checkMembershipDrift(
      [{ _id: 'g1', members: ['u1', 'u2'] }],
      [
        { _id: 'u1', groups: ['g1'] },
        { _id: 'u2', groups: [] },
        { _id: 'u3', groups: ['g1'] },
      ]
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every(f => f.severity === 'info')).toBe(true);
  });

  it('finds no drift when both sides agree', () => {
    expect(
      checkMembershipDrift(
        [{ _id: 'g1', members: ['u1'] }],
        [{ _id: 'u1', groups: ['g1'] }]
      )
    ).toEqual([]);
  });
});
