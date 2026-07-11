'use client';

import * as React from 'react';
import Link from 'next/link';
import { Building2, FilterX, Radar, SearchX } from 'lucide-react';
import { Button, Skeleton } from '@careerstack/ui';
import { EmptyState } from '@/components/common/states';
import type { ViewMode } from './explorer-toolbar';

/** View-appropriate loading skeleton for the explorer results (Req 40, 56). */
export function ResultsSkeleton({ view }: { view: ViewMode }) {
  if (view === 'card') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (view === 'table') {
    return <Skeleton className="h-80 w-full rounded-xl" aria-hidden />;
  }
  return (
    <div className="divide-y rounded-xl border" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-3">
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * First-use empty state (Req 45 states list): the user has no opportunities at
 * all yet — guide them to connect a source or create a search/profile.
 */
export function FirstUseEmptyState() {
  return (
    <EmptyState
      icon={Radar}
      title="No opportunities yet"
      description="Connect a source and set an active role profile — discovered opportunities will show up here to browse, filter, and save."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/app/sources">
              <Building2 className="size-4" aria-hidden />
              Connect a source
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/profiles/new">Create a role profile</Link>
          </Button>
        </div>
      }
    />
  );
}

/**
 * No-results state when filters are active — distinct from first-use so the
 * user knows to relax filters rather than that nothing exists (Req 45 states).
 */
export function FilteredNoResultsState({ onClearAll }: { onClearAll: () => void }) {
  return (
    <EmptyState
      icon={FilterX}
      title="No matches for these filters"
      description="Nothing matches your current filters. Try clearing some to widen the search."
      action={
        <Button variant="outline" onClick={onClearAll}>
          Clear all filters
        </Button>
      }
    />
  );
}

/** Generic no-results state (no filters active, but nothing came back). */
export function NoResultsState() {
  return (
    <EmptyState
      icon={SearchX}
      title="Nothing to show"
      description="There aren’t any opportunities to display right now. Check back once ingestion has run."
    />
  );
}
