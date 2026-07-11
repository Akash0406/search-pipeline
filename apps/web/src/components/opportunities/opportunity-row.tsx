'use client';

import * as React from 'react';
import Link from 'next/link';
import type { OpportunityListItem } from '@careerstack/contracts';
import { StatusBadge } from '@/components/common/status-badge';
import { DateTime } from '@/components/common/date-time';
import {
  EMPLOYMENT_TYPE_LABELS,
  formatLocations,
  formatSalary,
  WORK_ARRANGEMENT_LABELS,
} from '@/lib/opportunity-options';
import { FirstPartyMarker } from './first-party-marker';
import { SaveDismissActions } from './save-dismiss-actions';

/** One opportunity rendered as a compact list row (Req 40.1). */
export function OpportunityRow({ item }: { item: OpportunityListItem }) {
  const salary = formatSalary(item.salary);
  const locations = formatLocations(item.locations);
  const workArrangement = item.workArrangement
    ? WORK_ARRANGEMENT_LABELS[item.workArrangement]
    : undefined;
  const employmentType = item.employmentType
    ? EMPLOYMENT_TYPE_LABELS[item.employmentType]
    : undefined;

  const meta = [locations, workArrangement, employmentType, salary].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/app/opportunities/${item.id}`}
            className="truncate font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.title}
          </Link>
          {item.isFirstParty ? <FirstPartyMarker /> : null}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          <span className="text-foreground/80">{item.company}</span>
          {meta ? ` · ${meta}` : ''}
        </p>
      </div>

      <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        <DateTime value={item.lastUpdatedAt} />
      </div>
      <StatusBadge canonical={item.status} userState={item.userState} className="shrink-0" />
      <SaveDismissActions
        opportunityId={item.id}
        title={item.title}
        userState={item.userState}
        variant="icon"
        className="flex shrink-0 items-center"
      />
    </div>
  );
}
