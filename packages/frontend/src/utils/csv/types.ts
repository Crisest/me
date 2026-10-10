import { Transaction } from '@/types/Transaction';

/**
 * One bank's CSV export layout. Headers and row keys arrive trimmed and
 * lowercased by the pipeline.
 */
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
