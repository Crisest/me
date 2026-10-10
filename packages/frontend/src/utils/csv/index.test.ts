import { describe, it, expect } from 'vitest';
import { paparseCSVToTransaction } from '.';

describe('paparseCSVToTransaction', () => {
  it('maps a Scotiabank-style row', () => {
    const csv = [
      'Filter,Date,Description,Sub-description,Status,Type of Transaction,Amount',
      'x,2024-03-05,Coffee Shop,Downtown,Posted,Debit,-12.34',
    ].join('\n');

    const [row] = paparseCSVToTransaction(csv);

    expect(row.amount).toBe(-12.34);
    expect(row.date).toBe(new Date('2024-03-05').toISOString());
    expect(row.description).toBe('Coffee Shop');
    expect(row.subDescription).toBe('Downtown');
    expect(Object.keys(row).sort()).toEqual([
      'amount',
      'date',
      'description',
      'subDescription',
    ]);
  });

  it('matches headers case-insensitively and trims them', () => {
    const csv = ' DATE ,Amount,description\n2024-03-05,10,Rent';

    const [row] = paparseCSVToTransaction(csv);

    expect(row.date).toBe(new Date('2024-03-05').toISOString());
    expect(row.amount).toBe(10);
    expect(row.description).toBe('Rent');
  });

  it('drops pending rows', () => {
    const csv = [
      'Date,Description,Amount,Status',
      '2024-03-05,Held,-1,Pending',
      '2024-03-06,Settled,-2,Posted',
    ].join('\n');
    const lowercaseCsv = [
      'Date,Description,Amount,status',
      '2024-03-05,Held,-1,pending',
      '2024-03-06,Settled,-2,posted',
    ].join('\n');

    for (const text of [csv, lowercaseCsv]) {
      const result = paparseCSVToTransaction(text);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Settled');
    }
  });

  it('keeps rows with no status column', () => {
    const csv = 'Date,Description,Amount\n2024-03-05,Rent,-1';

    expect(paparseCSVToTransaction(csv)).toHaveLength(1);
  });

  it('treats sub-description as optional', () => {
    const csv = 'Date,Description,Amount\n2024-03-05,Rent,-1';

    const [row] = paparseCSVToTransaction(csv);

    expect(row).not.toHaveProperty('subDescription');
  });

  it('skips empty lines', () => {
    const csv = 'Date,Description,Amount\n2024-03-05,Rent,-1\n\n';

    expect(paparseCSVToTransaction(csv)).toHaveLength(1);
  });

  it('returns [] for a header-only CSV', () => {
    expect(paparseCSVToTransaction('Date,Description,Amount')).toEqual([]);
  });

  it('throws with the line number and column for an invalid amount', () => {
    const csv = [
      'Date,Description,Amount',
      '2024-03-05,Rent,-1',
      '2024-03-06,Food,abc',
    ].join('\n');

    expect(() => paparseCSVToTransaction(csv)).toThrow(/line 3/);
    // Headers are lowercased by the pipeline now, so the column reads "amount".
    expect(() => paparseCSVToTransaction(csv)).toThrow(/amount/i);
  });

  it('throws with the line number for an invalid date', () => {
    const csv = 'Date,Description,Amount\nnot-a-date,Rent,-1';

    expect(() => paparseCSVToTransaction(csv)).toThrow(/line 2/);
  });

  it('throws when a required column is missing', () => {
    const csv = 'Date,Amount\n2024-03-05,-1';

    // Date,Amount matches no format now, so detection fails before validation.
    expect(() => paparseCSVToTransaction(csv)).toThrow(
      /Unrecognized CSV format/,
    );
  });

  it('line numbers count pending rows', () => {
    const csv = [
      'Date,Description,Amount,Status',
      '2024-03-05,Held,-1,Pending',
      '2024-03-06,Food,abc,Posted',
    ].join('\n');

    expect(() => paparseCSVToTransaction(csv)).toThrow(/line 3/);
  });

  it('rejects a CSV no format recognises', () => {
    const csv = 'Transaction Date,Debit,Credit,Details\n2024-03-05,1,,Rent';

    expect(() => paparseCSVToTransaction(csv)).toThrow(
      /Unrecognized CSV format/,
    );
    expect(() => paparseCSVToTransaction(csv)).toThrow(/transaction date/);
  });

  it('skips preamble lines and a BOM before the header', () => {
    const csv = [
      '\uFEFFFollowing data is valid as of 20261010125943:',
      '',
      'Date,Description,Amount',
      '2024-03-05,Rent,-1',
    ].join('\r\n');

    const result = paparseCSVToTransaction(csv);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Rent');
    expect(result[0].amount).toBe(-1);
  });

  it('reports real file line numbers after a preamble', () => {
    const csv = [
      'Following data is valid as of 20261010125943:',
      '',
      'Date,Description,Amount',
      '2024-03-06,Food,abc',
    ].join('\n');

    expect(() => paparseCSVToTransaction(csv)).toThrow(/line 4/);
  });

  it('rejects a CSV with no recognisable header in the scan window', () => {
    const csv = [
      'Following data is valid as of 20261010125943:',
      '',
      'Transaction Date,Debit,Credit,Details',
      '2024-03-05,1,,Rent',
    ].join('\n');

    expect(() => paparseCSVToTransaction(csv)).toThrow(
      /Unrecognized CSV format/,
    );
  });

  it('parses a BMO export and never surfaces the card number', () => {
    const csv = [
      '\uFEFFFollowing data is valid as of 20261010125943:',
      '',
      'Item #,Card #,Transaction Date,Posting Date,Transaction Amount,Description',
      "1,'5524000000000000',20260808,20260810,78.1,9528-2828 * SAINTECATH SAINT HIPPOLYQC",
      "2,'5524000000000000',20260815,20260817,-10.0,CARMA FARMS MARKHAM ON",
    ].join('\r\n');

    const result = paparseCSVToTransaction(csv);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-08-08T00:00:00.000Z');
    expect(result[0].amount).toBe(78.1);
    expect(result[0].description).toBe(
      '9528-2828 * SAINTECATH SAINT HIPPOLYQC',
    );
    expect(result[1].amount).toBe(-10);
    expect(JSON.stringify(result)).not.toContain('5524000000000000');
  });
});
