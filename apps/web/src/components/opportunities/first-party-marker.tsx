import * as React from 'react';
import { BadgeCheck } from 'lucide-react';
import { cn } from '@careerstack/ui';

/**
 * Visible marker for first-party sources (Req 45.3): a role sourced directly
 * from the employer's own system (Greenhouse/Lever/Ashby/JSON-LD) rather than
 * an aggregator. Conveyed with an icon + text label (not colour alone, Req 57).
 */
export function FirstPartyMarker({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400',
        className,
      )}
      title="Sourced directly from the employer"
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      First-party
    </span>
  );
}
