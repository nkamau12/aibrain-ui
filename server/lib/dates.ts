/**
 * Format a Date as "YYYY-MM-DD" in the server's local timezone.
 *
 * JavaScript's toISOString() always emits UTC, which causes off-by-one day
 * errors for servers running in non-UTC timezones. This helper uses the local
 * getFullYear/getMonth/getDate accessors instead.
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
