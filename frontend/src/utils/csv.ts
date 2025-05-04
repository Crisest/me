import { TransactionRow } from '@/types/Transaction';

export const parseCSV = (text: string): TransactionRow[] => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(
      v => v.trim().replace(/^"|"$/g, ''), // remove wrapping quotes
    );
    const row: Partial<TransactionRow> = {};

    headers.forEach((header, i) => {
      row[header as keyof TransactionRow] = values[i];
    });

    return row as TransactionRow;
  });
};
