/**
 * Normalizes a transaction description for exact-match history lookup.
 *
 * Lowercases, strips non-alphanumeric characters to single spaces (so digits
 * that are part of an alphanumeric token, e.g. "7eleven", survive), drops any
 * trailing token that is digit-only (a store/reference number), collapses
 * whitespace, and trims. No fuzzy matching.
 */
export const normalizeDescription = (description: string): string => {
  const lowered = description.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const tokens = lowered.split(' ').filter(Boolean);

  while (tokens.length > 0 && /^\d+$/.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(' ').trim();
};
