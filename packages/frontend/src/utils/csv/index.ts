import { Transaction } from '@/types/Transaction';
import Papa from 'papaparse';
import { scotiabank } from './formats/scotiabank';
import { CsvFormat } from './types';

// First match wins, so list specific formats before generic ones
// (Scotiabank's detect is generic and must stay last).
const formats: CsvFormat[] = [scotiabank];

export const paparseCSVToTransaction = (text: string): Transaction[] => {
  const { data, errors, meta } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
  });

  if (errors.length > 0) {
    throw new Error(
      `CSV parse errors: ${errors.map(e => e.message).join(', ')}`,
    );
  }

  const headers = meta.fields ?? [];
  const format = formats.find(f => f.detect(headers));
  if (!format) {
    throw new Error(`Unrecognized CSV format. Headers: ${headers.join(', ')}`);
  }

  const transactions: Transaction[] = [];
  data.forEach((row, i) => {
    let mapped: Partial<Transaction> | null;
    try {
      mapped = format.mapRow(row);
    } catch (err) {
      throw new Error(
        `Error parsing value at line ${i + 2}, ${(err as Error).message}`,
      );
    }
    if (!mapped) return;

    if (!isValidTransaction(mapped)) {
      throw new Error(`Missing required fields at line ${i + 2}`);
    }
    transactions.push(mapped);
  });
  return transactions;
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
