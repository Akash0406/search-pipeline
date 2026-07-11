'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, Briefcase, Building2, MapPin } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@careerstack/ui';
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

/** One opportunity rendered as a card (Req 40.1). */
export function OpportunityCard({ item }: { item: OpportunityListItem }) {
  const salary = formatSalary(item.salary);
  const locations = formatLocations(item.locations);
  const workArrangement = item.workArrangement
    ? WORK_ARRANGEMENT_LABELS[item.workArrangement]
    : undefined;
  const employmentType = item.employmentType
    ? EMPLOYMENT_TYPE_LABELS[item.employmentType]
    : undefined;

  return (
    <Card className="flex h-full flex-col transition-colors hover:border-foreground/20">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <StatusBadge canonical={item.status} userState={item.userState} />
          {item.isFirstParty ? <FirstPartyMarker /> : null}
        </div>
        <h3 className="text-base font-semibold leading-snug">
          <Link
            href={`/app/opportunities/${item.id}`}
            className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.title}
          </Link>
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Building2 className="size-3.5 shrink-0" aria-hidden />
          {item.company}
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
        {locations ? (
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {locations}
            {workArrangement ? (
              <span className="text-foreground/70">· {workArrangement}</span>
            ) : null}
          </p>
        ) : null}
        {employmentType ? (
          <p className="flex items-center gap-1.5">
            <Briefcase className="size-3.5 shrink-0" aria-hidden />
            {employmentType}
          </p>
        ) : null}
        {salary ? (
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Banknote className="size-3.5 shrink-0" aria-hidden />
            {salary}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Updated <DateTime value={item.lastUpdatedAt} />
        </span>
        <SaveDismissActions
          opportunityId={item.id}
          title={item.title}
          userState={item.userState}
          variant="icon"
          className="flex items-center"
        />
      </CardFooter>
    </Card>
  );
}
