import * as React from 'react';
import { formatDateTime, formatExact, formatRelative } from '@/lib/format';

/**
 * Timezone-aware date/time display (Req 6.4, 46.3 / task 11.6).
 *
 * Renders a semantic `<time>` element showing either a relative ("3 days ago")
 * or absolute label, with the EXACT, unambiguous timestamp always available on
 * demand via the native `title` tooltip (and exposed to assistive tech). This
 * is a Server Component-safe primitive — no client JS required — so it can be
 * used directly in RSC list/detail pages.
 *
 * @param value  ISO timestamp string.
 * @param mode   `relative` (default) or `absolute` display.
 * @param timezone  IANA timezone (typically `user_preferences.timezone`).
 */
export interface DateTimeProps extends React.TimeHTMLAttributes<HTMLTimeElement> {
  value: string;
  mode?: 'relative' | 'absolute';
  timezone?: string;
}

export function DateTime({
  value,
  mode = 'relative',
  timezone,
  ...props
}: DateTimeProps) {
  const exact = formatExact(value, timezone);
  const label = mode === 'relative' ? formatRelative(value) : formatDateTime(value, timezone);

  return (
    <time dateTime={value} title={exact} aria-label={exact} {...props}>
      {label}
    </time>
  );
}
