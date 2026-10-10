import { Transaction } from '@/types/Transaction';
import { CsvFormat } from '../types';

const headerMapping: Record<string, keyof Transaction> = {
  date: 'date',
  amount: 'amount',
  description: 'description',
  'sub-description': 'subDescription',
};

const convertValue = (key: keyof Transaction, value: string): string | number => {
  switch (key) {
    case 'amount': {
      const num = parseFloat(value);
      if (isNaN(num)) throw new Error(`Invalid amount: "${value}"`);
      return num;
    }
    case 'date': {
      const d = new Date(value);
      if (isNaN(d.getTime())) throw new Error(`Invalid date: "${value}"`);
      return d.toISOString();
    }
    default:
      return value;
  }
};

export const scotiabank: CsvFormat = {
  id: 'scotiabank',
  detect: headers =>
    ['date', 'amount', 'description'].every(h => headers.includes(h)),
  mapRow(row) {
    if (row.status?.toLowerCase() === 'pending') return null;

    const mapped: Partial<Transaction> = {};
    for (const key in row) {
      if (!(key in headerMapping)) continue;
      const field = headerMapping[key];
      try {
        (mapped as Record<string, string | number>)[field] = convertValue(field, row[key]);
      } catch {
        throw new Error(`column ${key}: ${row[key]}`);
      }
    }
    return mapped;
  },
};
