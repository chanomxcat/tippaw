/** Money is stored as integer satang (1 THB = 100 satang) everywhere in the app. */

/** Converts a whole-baht amount (as entered in the UI) to integer satang. */
export function thbToSatang(thb: number): number {
  return Math.round(thb * 100);
}

/**
 * Formats integer satang as a Thai-locale baht string: thousands separators,
 * no decimals when the amount is a whole number of baht, otherwise exactly
 * 2 decimals.
 */
export function formatThb(satang: number): string {
  const thb = satang / 100;
  const isWhole = Number.isInteger(thb);
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(thb);
}
