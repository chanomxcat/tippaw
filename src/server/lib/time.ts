/**
 * Converts a date-only string (`YYYY-MM-DD`, as produced by an HTML
 * `<input type="date">`) to the end of that day in Asia/Bangkok (UTC+7, no
 * DST), so an invite "expiring on" a picked date stays valid through the
 * whole Thai day rather than expiring at UTC midnight (07:00 Bangkok time).
 * Returns `null` when `dateOnly` isn't a plain `YYYY-MM-DD` string.
 */
export function bangkokEndOfDay(dateOnly: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const date = new Date(`${dateOnly}T23:59:59.999+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
