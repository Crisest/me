import { Transaction } from '@/types/Transaction';
import Papa from 'papaparse';
import { bmo } from './formats/bmo';
import { scotiabank } from './formats/scotiabank';
import { CsvFormat } from './types';

// First match wins, so list specific formats before generic ones
// (Scotiabank's detect is generic and must stay last).
const formats: CsvFormat[] = [bmo, scotiabank];

// Some banks put a preamble before the header row; only scan this many lines.
const HEADER_SCAN_LINES = 10;

const normaliseHeader = (h: string) => h.trim().toLowerCase();

// Finds the first line (within the scan window) that some format recognises
// as its header. `skipped` is the number of lines before it.
const findHeader = (lines: string[]) => {
  let firstFields: string[] | undefined;
  for (const [skipped, line] of lines.slice(0, HEADER_SCAN_LINES).entries()) {
    if (!line.trim()) continue;
    const fields = (Papa.parse<string[]>(line).data[0] ?? []).map(
      normaliseHeader,
    );
    firstFields ??= fields;
    const format = formats.find(f => f.detect(fields));
    if (format) return { format, skipped };
  }
  throw new Error(
    `Unrecognized CSV format. Headers: ${(firstFields ?? []).join(', ')}`,
  );
};

export const paparseCSVToTransaction = (text: string): Transaction[] => {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const { format, skipped } = findHeader(lines);

  const { data, errors } = Papa.parse<Record<string, string>>(
    lines.slice(skipped).join('\n'),
    {
      header: true,
      skipEmptyLines: true,
      transformHeader: normaliseHeader,
    },
  );

  if (errors.length > 0) {
    throw new Error(
      `CSV parse errors: ${errors.map(e => e.message).join(', ')}`,
    );
  }

  const transactions: Transaction[] = [];
  data.forEach((row, i) => {
    let mapped: Partial<Transaction> | null;
    try {
      mapped = format.mapRow(row);
    } catch (err) {
      throw new Error(
        `Error parsing value at line ${i + 2 + skipped}, ${(err as Error).message}`,
      );
    }
    if (!mapped) return;

    if (!isValidTransaction(mapped)) {
      throw new Error(`Missing required fields at line ${i + 2 + skipped}`);
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
