/**
 * Opportunity status mapping (Req 46.1, 46.2 / task 11.6).
 *
 * Two responsibilities, kept pure and framework-free so any surface can reuse
 * them:
 *  1. Overlay the per-user Saved/Dismissed state on top of the canonical status
 *     to produce the single label to display (Req 43 + 46).
 *  2. Map every member of the FIXED display vocabulary to a meaningful design
 *     token colour (Badge variant). The mapping is exhaustive over
 *     {@link DisplayStatus}, so only labels from the closed set can be rendered
 *     (Property 26 / Req 46.1).
 */
import type { BadgeProps } from '@careerstack/ui';
import type { CanonicalStatus, DisplayStatus, UserState } from '@careerstack/contracts';

/** Badge colour variant, narrowed from the design system's Badge. */
type BadgeVariant = NonNullable<BadgeProps['variant']>;

/**
 * The complete, fixed display vocabulary (Req 46.1). Duplicated here as a
 * runtime array so components can validate/iterate without importing Zod. Kept
 * in lockstep with `displayStatusSchema` in `@careerstack/contracts`.
 */
export const DISPLAY_STATUSES: readonly DisplayStatus[] = [
  'New',
  'Active',
  'Closing soon',
  'Closed',
  'Expired',
  'Removed',
  'Needs review',
  'Duplicate',
  'Saved',
  'Applied',
  'Dismissed',
] as const;

/**
 * Resolve the label to display for an opportunity (Req 46.2). The per-user
 * overlay wins when present: a saved/dismissed opportunity shows that state,
 * otherwise the canonical status is shown. The result is always a member of the
 * fixed display vocabulary.
 */
export function resolveDisplayStatus(
  canonical: CanonicalStatus,
  userState: UserState = 'none',
): DisplayStatus {
  if (userState === 'saved') return 'Saved';
  if (userState === 'dismissed') return 'Dismissed';
  return canonical;
}

/**
 * Meaningful colour per status (Req 46). Exhaustive over the display
 * vocabulary; the design palette maps as:
 *  - New          → primary  (electric indigo — fresh, needs attention)
 *  - Active        → success  (emerald — open/available)
 *  - Closing soon  → warning  (amber — time-sensitive)
 *  - Closed        → muted    (slate — no longer open)
 *  - Expired       → muted    (slate — lapsed)
 *  - Removed       → destructive (red — taken down)
 *  - Needs review  → warning  (amber — awaiting adjudication)
 *  - Duplicate     → outline  (neutral/meta)
 *  - Saved         → secondary (cyan-blue — a positive user action)
 *  - Applied       → default  (primary — user milestone)
 *  - Dismissed     → muted    (slate — set aside by the user)
 */
const STATUS_VARIANTS: Record<DisplayStatus, BadgeVariant> = {
  New: 'default',
  Active: 'success',
  'Closing soon': 'warning',
  Closed: 'muted',
  Expired: 'muted',
  Removed: 'destructive',
  'Needs review': 'warning',
  Duplicate: 'outline',
  Saved: 'secondary',
  Applied: 'default',
  Dismissed: 'muted',
};

/** Badge colour variant for a given display status. */
export function statusBadgeVariant(status: DisplayStatus): BadgeVariant {
  return STATUS_VARIANTS[status];
}

/** Type guard: is a value a member of the fixed display vocabulary? */
export function isDisplayStatus(value: string): value is DisplayStatus {
  return (DISPLAY_STATUSES as readonly string[]).includes(value);
}
