import { Transaction } from '@/types/Transaction';

const headerMapping: Record<string, keyof Transaction> = {
  // Standard headers
  date: 'date',
  amount: 'amount',
  description: 'description',
  category: 'category',
  // Common variations
  Date: 'date',
  Amount: 'amount',
  Description: 'description',
  'Sub-description': 'category',
  Status: 'category',
  'Type of Transaction': 'category',
  Filter: 'category',
};

const isValidTransactionKey = (
  key: string,
): key is keyof typeof headerMapping => {
  return key in headerMapping;
};

const convertValue = (key: keyof Transaction, value: string): any => {
  switch (key) {
    case 'amount':
      return parseFloat(value);
    case 'date':
      return new Date(value).toISOString();
    default:
      return value;
  }
};

export const parseCSVToTransaction = (text: string): Transaction[] => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  // Validate headers
  const invalidHeaders = headers.filter(
    header => !isValidTransactionKey(header),
  );
  if (invalidHeaders.length > 0) {
    throw new Error(`Invalid headers found: ${invalidHeaders.join(', ')}`);
  }

  return lines.slice(1).map((line, lineIndex) => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '')); // remove wrapping quotes
    const row: Partial<Transaction> = {};

    headers.forEach((header, i) => {
      if (isValidTransactionKey(header)) {
        const mappedKey = headerMapping[header];
        try {
          row[mappedKey] = convertValue(mappedKey, values[i]);
        } catch (error) {
          throw new Error(
            `Error parsing value at line ${lineIndex + 2}, column ${header}: ${values[i]}`,
          );
        }
      }
    });

    if (!isValidTransaction(row)) {
      throw new Error(`Missing required fields at line ${lineIndex + 2}`);
    }

    return row as Transaction;
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
