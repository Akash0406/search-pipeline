import * as React from 'react';
import { Badge, cn } from '@careerstack/ui';
import type { CanonicalStatus, DisplayStatus, UserState } from '@careerstack/contracts';
import { resolveDisplayStatus, statusBadgeVariant } from '@/lib/status';

/**
 * Shared opportunity status badge (Req 46.1–46.2 / task 11.6).
 *
 * Renders ONLY the fixed display vocabulary with a meaningful, consistent
 * colour per status. Reused across the explorer, detail view, and dashboard so
 * status language stays uniform everywhere.
 *
 * Accepts either an already-resolved {@link DisplayStatus} via `status`, or a
 * canonical status + per-user overlay via `canonical`/`userState` (the overlay
 * wins, per Req 43 + 46.2). A small status dot aids non-colour perception
 * (accessibility, Req 57).
 */
export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A pre-resolved display label. Mutually exclusive with `canonical`. */
  status?: DisplayStatus;
  /** Canonical status to resolve against the per-user overlay. */
  canonical?: CanonicalStatus;
  /** Per-user overlay applied to `canonical` (defaults to `none`). */
  userState?: UserState;
  /** Hide the leading status dot. */
  hideDot?: boolean;
}

export function StatusBadge({
  status,
  canonical,
  userState = 'none',
  hideDot = false,
  className,
  ...props
}: StatusBadgeProps) {
  const label: DisplayStatus =
    status ?? (canonical ? resolveDisplayStatus(canonical, userState) : 'New');
  const variant = statusBadgeVariant(label);

  return (
    <Badge variant={variant} className={cn('gap-1.5', className)} {...props}>
      {hideDot ? null : (
        <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      )}
      {label}
    </Badge>
  );
}
