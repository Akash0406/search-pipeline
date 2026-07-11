'use client';

import * as React from 'react';
import { Clock, Info } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@careerstack/ui';
import { useRetentionPolicy } from '@/lib/api/privacy';
import { ErrorState } from '@/components/common/states';

/** Format a day count as a friendly duration. */
function formatDays(days: number): string {
  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? '1 year' : `${years} years`;
  }
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? '1 month' : `${months} months`;
  }
  return days === 1 ? '1 day' : `${days} days`;
}

/**
 * Surface the configurable raw-source retention policy (Req 53.1): the platform
 * default, any per-user override, and the effective window. This is read-only —
 * canonical opportunities remain accessible even after raw artifacts are
 * removed by retention (Req 53.3).
 */
export function RetentionSection() {
  const query = useRetentionPolicy();
  const policy = query.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          Data retention
        </CardTitle>
        <CardDescription>
          How long we keep the raw source artifacts we fetch on your behalf.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : query.isError ? (
          <ErrorState
            title="Couldn’t load the retention policy"
            onRetry={() => void query.refetch()}
          />
        ) : policy ? (
          <div className="space-y-3 text-sm">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Platform default</dt>
                <dd className="mt-1 font-medium">{formatDays(policy.rawRetentionDays)}</dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Your override</dt>
                <dd className="mt-1 font-medium">
                  {policy.userOverrideDays === null
                    ? 'None'
                    : formatDays(policy.userOverrideDays)}
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Effective window</dt>
                <dd className="mt-1 font-medium">{formatDays(policy.effectiveDays)}</dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              After this window, raw artifacts are deleted or anonymized. The opportunities we’ve
              already built from them stay accessible.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
