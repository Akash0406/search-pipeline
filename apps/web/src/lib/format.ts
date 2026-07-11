/**
 * Single timezone-aware date/time formatting helper (Req 6.4, 46.3). All
 * timestamps render in the user's timezone with the exact value available on
 * demand (e.g., as a tooltip/`title`).
 */

/** Format an ISO timestamp in the given IANA timezone (or the runtime default). */
export function formatDateTime(iso: string, timezone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

/** Exact, unambiguous timestamp for tooltips / "on demand" display. */
export function formatExact(iso: string, timezone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'long',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

/** Thresholds (in seconds) for choosing a relative-time unit. */
const RELATIVE_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

/**
 * Human relative time (e.g., "3 days ago", "in 2 hours") relative to `now`.
 * Timezone-independent (a duration), complementing {@link formatDateTime}. Pair
 * with {@link formatExact} to show the precise value on demand (Req 46.3).
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  let duration = (date.getTime() - now.getTime()) / 1000; // seconds, signed

  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatDateTime(iso);
}
