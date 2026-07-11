'use client';

import * as React from 'react';
import { Building2, Loader2, MoreVertical, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import type { Connection } from '@careerstack/contracts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@careerstack/ui';
import { ApiError } from '@/lib/api/client';
import { useTriggerRun, useUpdateConnection } from '@/lib/api/connections';
import { DateTime } from '@/components/common/date-time';
import {
  CONNECTION_STATUS_META,
  HEALTH_META,
  connectionLabel,
  connectionTarget,
} from '@/lib/connection-options';
import { SOURCE_TYPE_LABELS } from '@/lib/opportunity-options';

/**
 * A single connection as a card (Req 24, 25): connector type + target, status,
 * health, and last-run summary, with run-now / pause-resume / view-runs /
 * remove actions. Removal is delegated to the parent via `onRemove` so it can
 * confirm behind a dialog (Req 25.2).
 */
export function ConnectionCard({
  connection,
  timezone,
  onViewRuns,
  onRemove,
}: {
  connection: Connection;
  timezone?: string;
  onViewRuns: (connection: Connection) => void;
  onRemove: (connection: Connection) => void;
}) {
  const update = useUpdateConnection();
  const run = useTriggerRun();

  const label = connectionLabel(connection);
  const target = connectionTarget(connection);
  const statusMeta = CONNECTION_STATUS_META[connection.status];
  const healthMeta = HEALTH_META[connection.healthStatus];
  const isRemoved = connection.status === 'removed';
  const isPaused = connection.status === 'paused';
  const busy = update.isPending || run.isPending;

  const reportError = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiError ? error.message : fallback);

  const onRunNow = () => {
    run.mutate(connection.id, {
      onSuccess: () => toast.success('Run started', { description: `${label} is fetching now.` }),
      onError: (error) => reportError(error, 'Couldn’t start a run. Please try again.'),
    });
  };

  const onTogglePause = () => {
    const nextStatus = isPaused ? 'active' : 'paused';
    update.mutate(
      { id: connection.id, body: { status: nextStatus } },
      {
        onSuccess: () =>
          toast.success(isPaused ? `Resumed ${label}` : `Paused ${label}`, {
            description: isPaused
              ? 'Scheduled runs will resume.'
              : 'Scheduled runs are stopped. Your data is kept.',
          }),
        onError: (error) => reportError(error, 'Couldn’t update the source. Please try again.'),
      },
    );
  };

  const lastRun = connection.lastRun;

  return (
    <Card className={isRemoved ? 'opacity-70' : undefined}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"
            >
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {SOURCE_TYPE_LABELS[connection.sourceType]}
                {target ? ` · ${target}` : ''}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={`Actions for ${label}`}
                disabled={isRemoved || busy}
              >
                <MoreVertical className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => onViewRuns(connection)}>
                View run history
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onTogglePause} disabled={busy}>
                {isPaused ? 'Resume source' : 'Pause source'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onRemove(connection)}
                disabled={busy}
              >
                <Trash2 className="size-4" aria-hidden />
                Remove source
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={statusMeta.variant} className="gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
            {statusMeta.label}
          </Badge>
          <Badge variant={healthMeta.variant}>{healthMeta.label}</Badge>
          {connection.consecutiveFailures > 0 ? (
            <span className="text-xs text-muted-foreground">
              {connection.consecutiveFailures} consecutive failures
            </span>
          ) : null}
        </div>

        {connection.lastHealthReason ? (
          <p className="text-xs text-muted-foreground">{connection.lastHealthReason}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {lastRun ? (
              <>
                Last run{' '}
                <DateTime
                  value={lastRun.finishedAt ?? lastRun.startedAt}
                  {...(timezone ? { timezone } : {})}
                  mode="relative"
                />
                {lastRun.status === 'succeeded'
                  ? ` · ${lastRun.itemsPersisted} saved`
                  : lastRun.status === 'failed'
                    ? ' · failed'
                    : ' · running'}
              </>
            ) : (
              'No runs yet'
            )}
          </p>
          <Button variant="outline" size="sm" onClick={onRunNow} disabled={isRemoved || busy}>
            {run.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : isPaused ? (
              <Play className="size-4" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Run now
          </Button>
        </div>

        {isPaused && !isRemoved ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start px-0"
            onClick={onTogglePause}
            disabled={busy}
          >
            <Play className="size-4" aria-hidden />
            Resume scheduled runs
          </Button>
        ) : !isRemoved ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start px-0"
            onClick={onTogglePause}
            disabled={busy}
          >
            <Pause className="size-4" aria-hidden />
            Pause scheduled runs
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
