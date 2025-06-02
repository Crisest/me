# Utils Documentation

## CSV Parser

The current implementation provides a flexible CSV parser that maps various header formats to our Transaction type. It's designed to be extensible for future CSV formats.

### Current Features

- Header mapping for multiple formats
- Value type conversion
- Validation for required fields
- Error handling with line numbers

### Usage Example

```typescript
import { parseCSVToTransaction } from '@/utils/csv';

const csvContent = `Date,Description,Amount
2024-01-01,Coffee,5.99
2024-01-02,Groceries,50.00`;

const transactions = parseCSVToTransaction(csvContent);
```

### Supported Header Formats

Currently supports these header mappings:

```typescript
{
  // Standard headers
  date: 'date',
  amount: 'amount',
  description: 'description',
  category: 'category',

  // Variations
  Date: 'date',
  Amount: 'amount',
  Description: 'description',
  'Sub-description': 'category',
  Status: 'category',
  'Type of Transaction': 'category',
  Filter: 'category'
}
```

## Future Implementation Options

Here are some strategies for extending the CSV parser in the future:

### 1. CSV Format Presets

Define multiple CSV formats that can be selected when parsing:

```typescript
interface CSVFormat {
  name: string;
  headerMapping: Record<string, keyof Transaction>;
  transforms?: Record<keyof Transaction, (value: string) => any>;
}

const csvFormats = {
  default: {
    name: 'Default Format',
    headerMapping: {
      date: 'date',
      amount: 'amount',
      description: 'description',
    },
  },
  bankFormat1: {
    name: 'Bank Export',
    headerMapping: {
      Date: 'date',
      Description: 'description',
      Amount: 'amount',
    },
  },
};

// Usage
parseCSV(content, 'bankFormat1');
```

### 2. Automatic Format Detection

Automatically detect the CSV format based on headers:

```typescript
interface HeaderDetectionRule {
  format: string;
  detect: (headers: string[]) => boolean;
}

const rules = [
  {
    format: 'bankFormat1',
    detect: headers =>
      headers.includes('Filter') && headers.includes('Type of Transaction'),
  },
];

// Usage
const format = detectCSVFormat(headers);
parseCSV(content, format);
```

### 3. Custom Value Transformations

Add specific transformations for different value formats commonly found in bank exports:

```typescript
const transformers = {
  amount: [
    // Handle negative amounts with parentheses: (123.45)
    {
      test: value => value.startsWith('(') && value.endsWith(')'),
      transform: value => -parseFloat(value.slice(1, -1)),
    },
    // Handle amounts with currency symbols: $123.45, €123.45
    {
      test: value => /^[£$€]/.test(value),
      transform: value => parseFloat(value.slice(1)),
    },
    // Handle amounts with thousand separators: 1,234.56
    {
      test: value => value.includes(','),
      transform: value => parseFloat(value.replace(/,/g, '')),
    },
  ],
  date: [
    // Handle DD/MM/YYYY format
    {
      test: value => /^\d{2}\/\d{2}\/\d{4}$/.test(value),
      transform: value => {
        const [day, month, year] = value.split('/');
        return new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
        ).toISOString();
      },
    },
    // Handle MM-DD-YYYY format
    {
      test: value => /^\d{2}-\d{2}-\d{4}$/.test(value),
      transform: value => {
        const [month, day, year] = value.split('-');
        return new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
        ).toISOString();
      },
    },
    // Handle YYYY-MM-DD format
    {
      test: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
      transform: value => new Date(value).toISOString(),
    },
  ],
  description: [
    // Clean up extra whitespace
    {
      test: () => true, // Apply to all descriptions
      transform: value => value.trim().replace(/\s+/g, ' '),
    },
    // Remove common bank reference prefixes
    {
      test: value => value.startsWith('POS ') || value.startsWith('ACH '),
      transform: value => value.replace(/^(POS |ACH )/, ''),
    },
  ],
  category: [
    // Standardize category names
    {
      test: () => true,
      transform: value => value.toLowerCase().trim(),
    },
  ],
};
```

## Best Practices

1. **Adding New Formats**

   - Document the header format
   - Add test cases for the new format
   - Update the header mapping
   - Consider adding a template file

2. **Error Handling**

   - Validate required fields
   - Provide clear error messages with line numbers
   - Validate data types and formats

3. **Testing**
   - Test with sample files from different sources
   - Include edge cases (empty files, missing headers)
   - Validate transformed data

## File Reader Utility

The `fileReader.ts` utility provides functions for reading and parsing files:

```typescript
// Read file content as text
const content = await readFileContent(file);

// Parse file with specific parser
const data = await parseFileContent(file, parser);
```

This documentation will be updated as new features and formats are added.
