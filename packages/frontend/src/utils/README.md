# Utils Documentation

## CSV Parser

`paparseCSVToTransaction(text)` (in `csv/index.ts`) parses the file with PapaParse, trimming and lowercasing headers. It picks the first format in the `formats` array whose `detect` matches the headers, then calls that format's `mapRow` on each row (a `null` return skips the row). Each result must have `date`, `amount` and `description`. Errors carry the file line number. Formats are tried in order, and `scotiabank` is the generic fallback, so it stays last.

```ts
// csv/types.ts
export interface CsvFormat {
  id: string;
  /** True when these headers belong to this bank's export. */
  detect(headers: string[]): boolean;
  /**
   * Map one data row. Return null to skip the row (e.g. pending).
   * Throw on a bad value; the pipeline adds the line number.
   */
  mapRow(row: Record<string, string>): Partial<Transaction> | null;
}
```

### Adding a bank

- [ ] Create `csv/formats/<bank>.ts` exporting a `CsvFormat`.
- [ ] Register it in the `formats` array in `csv/index.ts` **before** `scotiabank`.
- [ ] Make `detect` specific: match a column only that bank exports.
- [ ] Add tests with a real (anonymised) header row.
- [ ] Run `pnpm --filter frontend test`.

Note: the bank selected in the upload modal is not passed to the parser; detection is purely header-based.

## File Reader Utility

The `fileReader.ts` utility provides functions for reading and parsing files:

```typescript
// Read file content as text
const content = await readFileContent(file);

// Parse file with specific parser
const data = await parseFileContent(file, parser);
```

This documentation will be updated as new features and formats are added.
