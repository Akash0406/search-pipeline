'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

/** Human-readable labels for known path segments. */
const SEGMENT_LABELS: Record<string, string> = {
  app: 'Home',
  admin: 'Admin',
  opportunities: 'Opportunities',
  sources: 'Sources',
  profiles: 'Profiles',
  settings: 'Settings',
  sessions: 'Sessions',
  privacy: 'Privacy',
  'connector-health': 'Connector health',
};

function labelFor(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}

/**
 * Breadcrumb trail derived from the current pathname (Design §8 app shell).
 * The last crumb represents the current page and is not a link.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    return { label: labelFor(segment), href };
  });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              ) : null}
              {isLast ? (
                <span className="truncate font-medium" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
