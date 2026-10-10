import { CsvFormat } from '../types';

const parseYyyymmdd = (value: string): string => {
  if (!/^\d{8}$/.test(value)) throw new Error('bad date');
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error('impossible date');
  }
  return date.toISOString();
};

export const bmo: CsvFormat = {
  id: 'bmo',
  detect: headers =>
    ['item #', 'posting date', 'transaction amount'].every(h =>
      headers.includes(h),
    ),
  mapRow(row) {
    let date: string;
    try {
      date = parseYyyymmdd(row['transaction date'] ?? '');
    } catch {
      throw new Error(`column transaction date: ${row['transaction date']}`);
    }

    const amount = parseFloat(row['transaction amount']);
    if (isNaN(amount)) {
      throw new Error(`column transaction amount: ${row['transaction amount']}`);
    }

    return { date, amount, description: (row.description ?? '').trim() };
  },
};
