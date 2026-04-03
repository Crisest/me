import { Transaction } from '@/types/Transaction';
import Papa from 'papaparse';

const headerMapping: Record<string, keyof Transaction> = {
  date: 'date',
  amount: 'amount',
  description: 'description',
  category: 'category',
  'sub-description': 'category',
  status: 'category',
  'type of transaction': 'category',
  filter: 'category',
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

export const paparseCSVToTransaction = (text: string): Transaction[] => {
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length > 0) {
    throw new Error(
      `CSV parse errors: ${errors.map(e => e.message).join(', ')}`,
    );
  }

  return data.map((row, lineIndex) => {
    const mappedRow: Partial<Transaction> = {};
    for (const header in row) {
      const normalizedHeader = header.toLowerCase().trim();
      if (normalizedHeader in headerMapping) {
        const mappedKey = headerMapping[normalizedHeader];
        try {
          (mappedRow as Record<string, string | number>)[mappedKey] = convertValue(mappedKey, row[header]);
        } catch {
          throw new Error(
            `Error parsing value at line ${lineIndex + 2}, column ${header}: ${row[header]}`,
          );
        }
      }
    }

    if (!isValidTransaction(mappedRow)) {
      throw new Error(`Missing required fields at line ${lineIndex + 2}`);
    }

    return mappedRow as Transaction;
  });
};

const isValidTransaction = (
  transaction: Partial<Transaction>,
): transaction is Transaction => {
  const requiredFields: Array<keyof Transaction> = [
    'date',
    'amount',
    'description',
  ];
  return requiredFields.every(field => transaction[field] !== undefined);
};
