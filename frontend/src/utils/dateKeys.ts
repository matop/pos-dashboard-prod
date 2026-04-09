/** Convert a Date to its YYYYMMDD integer key. */
export function dateToKey(d: Date): number {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return parseInt(`${y}${m}${day}`);
}

/** Parse a YYYYMMDD integer key back to a Date. Returns current date on invalid input. */
export function keyToDate(key: number): Date {
  const s = String(key);
  if (s.length !== 8) return new Date();
  const date = new Date(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
  return isNaN(date.getTime()) ? new Date() : date;
}

/** Parse a YYYYMMDD string (e.g. from URL param) into a Date. Returns null if invalid. */
export function parseRefDateString(s: string): Date | null {
  if (!/^\d{8}$/.test(s)) return null;
  const y = parseInt(s.slice(0, 4)), m = parseInt(s.slice(4, 6)), d = parseInt(s.slice(6, 8));
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/**
 * Format a YYYYMMDD integer key for display.
 * - 'short': DD/MM
 * - 'medium': DD/MM/YY
 * - 'long': DD/MM/YYYY
 */
export function formatDayKey(key: number, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const s = String(key);
  const dd = s.slice(6, 8);
  const mm = s.slice(4, 6);
  if (format === 'short') return `${dd}/${mm}`;
  if (format === 'medium') return `${dd}/${mm}/${s.slice(2, 4)}`;
  return `${dd}/${mm}/${s.slice(0, 4)}`;
}
