export function formatCAD(amount: number): string {
  return amount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function titleCaseFromSnake(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .join(' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bAnd\b/g, 'and');
}

export function formatPlaidCategory(value?: string | null): string {
  if (!value) return '';
  return titleCaseFromSnake(value);
}

export function formatPlaidDetailedCategory(
  detailed?: string | null,
  primary?: string | null,
): string {
  if (!detailed) return '';
  let remainder = detailed;
  if (primary && detailed.toUpperCase().startsWith(primary.toUpperCase() + '_')) {
    remainder = detailed.slice(primary.length + 1);
  }
  return titleCaseFromSnake(remainder) || titleCaseFromSnake(detailed);
}
