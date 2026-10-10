import { describe, it, expect } from 'vitest';
import { bmo } from './bmo';
import { scotiabank } from './scotiabank';

const bmoHeaders = [
  'item #',
  'card #',
  'transaction date',
  'posting date',
  'transaction amount',
  'description',
];

const scotiabankHeaders = [
  'filter',
  'date',
  'description',
  'sub-description',
  'status',
  'type of transaction',
  'amount',
];

const row = {
  'item #': '1',
  'card #': "'5524000000000000'",
  'transaction date': '20260808',
  'posting date': '20260810',
  'transaction amount': '78.1',
  description: '9528-2828 * SAINTECATH SAINT HIPPOLYQC',
};

describe('bmo format', () => {
  it('detects a BMO header set', () => {
    expect(bmo.detect(bmoHeaders)).toBe(true);
  });

  it('does not detect a Scotiabank header set', () => {
    expect(bmo.detect(scotiabankHeaders)).toBe(false);
  });

  it('is not detected by the Scotiabank format', () => {
    expect(scotiabank.detect(bmoHeaders)).toBe(false);
  });

  it('maps a purchase row using the transaction date', () => {
    expect(bmo.mapRow(row)).toEqual({
      date: '2026-08-08T00:00:00.000Z',
      amount: 78.1,
      description: '9528-2828 * SAINTECATH SAINT HIPPOLYQC',
    });
  });

  it('keeps the sign of a refund', () => {
    const mapped = bmo.mapRow({
      ...row,
      'transaction amount': '-10.0',
      description: 'CARMA FARMS MARKHAM ON',
    });
    expect(mapped?.amount).toBe(-10);
  });

  it('never outputs the card number', () => {
    const mapped = bmo.mapRow(row)!;
    expect(mapped).not.toHaveProperty('card #');
    expect(JSON.stringify(mapped)).not.toContain('5524000000000000');
  });

  it('names the column of an invalid amount', () => {
    expect(() => bmo.mapRow({ ...row, 'transaction amount': 'abc' })).toThrow(
      /column transaction amount/,
    );
  });

  it('names the column of an invalid date', () => {
    for (const bad of ['2026-08-08', '20260231']) {
      expect(() => bmo.mapRow({ ...row, 'transaction date': bad })).toThrow(
        /column transaction date/,
      );
    }
  });
});
