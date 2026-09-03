export type PressureTone = 'ok' | 'warning' | 'over';

/**
 * Where a category sits against its plan. Colour carries the pressure, so a
 * category at 83% of its budget stops looking like one at 5%.
 *
 * A plan of zero has no ratio to report — an unbudgeted category is not
 * "over", it is unmeasured, so it reads as `ok`.
 */
export const pressureTone = (actual: number, planned: number): PressureTone => {
  if (planned <= 0) return 'ok';
  const ratio = actual / planned;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.7) return 'warning';
  return 'ok';
};

/** Bar width as a whole percent, clamped to 100 so an overspend cannot overflow. */
export const pressurePercent = (actual: number, planned: number): number =>
  planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
