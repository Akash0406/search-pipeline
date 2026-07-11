'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { Connection, ConnectorRun } from '@careerstack/contracts';
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@careerstack/ui';
import { useConnectionRuns } from '@/lib/api/connections';
import { EmptyState, ErrorState } from '@/components/common/states';
import { DateTime } from '@/components/common/date-time';
import { connectionLabel } from '@/lib/connection-options';

const RUN_STATUS_META: Record<
  ConnectorRun['status'],
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  running: { label: 'Running', icon: Loader2, className: 'text-primary' },
  succeeded: { label: 'Succeeded', icon: CheckCircle2, className: 'text-success' },
  failed: { label: 'Failed', icon: AlertCircle, className: 'text-destructive' },
};

/** A single run row: outcome, timing, item counts, and any failure reason. */
function RunRow({ run, timezone }: { run: ConnectorRun; timezone?: string }) {
  const meta = RUN_STATUS_META[run.status];
  const Icon = meta.icon;
  return (
    <li className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-1.5 text-sm font-medium ${meta.className}`}>
          <Icon
            className={`size-4 ${run.status === 'running' ? 'animate-spin' : ''}`}
            aria-hidden
          />
          {meta.label}
        </span>
        <span className="text-xs text-muted-foreground">
          <DateTime value={run.startedAt} {...(timezone ? { timezone } : {})} mode="relative" />
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{run.itemsDiscovered} found</Badge>
        <Badge variant="outline">{run.itemsFetched} fetched</Badge>
        <Badge variant="outline">{run.itemsParsed} parsed</Badge>
        <Badge variant="outline">{run.itemsPersisted} saved</Badge>
        {run.itemsFailed > 0 ? <Badge variant="destructive">{run.itemsFailed} failed</Badge> : null}
      </div>
      {run.failureReason ? <p className="text-xs text-destructive">{run.failureReason}</p> : null}
    </li>
  );
}

/** History of runs for one connection (Req 24.1–24.3). */
export function ConnectionRunsDialog({
  connection,
  onOpenChange,
  timezone,
}: {
  connection: Connection | null;
  onOpenChange: (open: boolean) => void;
  timezone?: string;
}) {
  const runs = useConnectionRuns(connection?.id);

  return (
    <Dialog open={Boolean(connection)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run history</DialogTitle>
          <DialogDescription>{connection ? connectionLabel(connection) : ''}</DialogDescription>
        </DialogHeader>

        {runs.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : runs.isError ? (
          <ErrorState title="Couldn’t load runs" onRetry={() => void runs.refetch()} />
        ) : (runs.data?.runs.length ?? 0) === 0 ? (
          <EmptyState
            title="No runs yet"
            description="This source hasn’t run yet. Use “Run now” to fetch opportunities immediately."
          />
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {runs.data!.runs.map((run) => (
              <RunRow key={run.id} run={run} {...(timezone ? { timezone } : {})} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
