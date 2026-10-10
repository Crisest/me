import { describe, it, expect } from 'vitest';
import { scotiabank } from './scotiabank';

describe('scotiabank format', () => {
  it('detects a Scotiabank header set', () => {
    expect(
      scotiabank.detect([
        'filter',
        'date',
        'description',
        'sub-description',
        'status',
        'type of transaction',
        'amount',
      ]),
    ).toBe(true);
  });

  it('does not detect an unrelated header set', () => {
    expect(
      scotiabank.detect(['transaction date', 'debit', 'credit', 'details']),
    ).toBe(false);
  });

  it('maps a pending row to null', () => {
    expect(
      scotiabank.mapRow({
        status: 'pending',
        date: '2024-01-01',
        amount: '1',
        description: 'x',
      }),
    ).toBeNull();
  });

  it('names the column of an invalid amount', () => {
    expect(() =>
      scotiabank.mapRow({
        date: '2024-01-01',
        amount: 'abc',
        description: 'x',
      }),
    ).toThrow(/column amount/);
  });
});
