// Utility to normalize date input (string or Date) to a JS Date object
export function normalizeDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  // Accept ISO string or other string formats
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  return parsed;
}
