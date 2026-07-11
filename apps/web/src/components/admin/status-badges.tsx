import * as React from 'react';
import { Badge, type BadgeProps, cn } from '@careerstack/ui';
import type { ConnectorRunStatus, HealthStatus } from '@careerstack/contracts';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const HEALTH_VARIANTS: Record<HealthStatus, BadgeVariant> = {
  healthy: 'success',
  degraded: 'warning',
  failing: 'destructive',
  unknown: 'muted',
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  failing: 'Failing',
  unknown: 'Unknown',
};

/** Colour-coded connection health badge (Req 47.1). A dot aids non-colour perception (Req 57). */
export function HealthBadge({ status, className }: { status: HealthStatus; className?: string }) {
  return (
    <Badge variant={HEALTH_VARIANTS[status]} className={cn('gap-1.5', className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {HEALTH_LABELS[status]}
    </Badge>
  );
}

const RUN_VARIANTS: Record<ConnectorRunStatus, BadgeVariant> = {
  running: 'default',
  succeeded: 'success',
  failed: 'destructive',
};

const RUN_LABELS: Record<ConnectorRunStatus, string> = {
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
};

/** Colour-coded connector-run status badge (Req 47.2). */
export function RunStatusBadge({
  status,
  className,
}: {
  status: ConnectorRunStatus;
  className?: string;
}) {
  return (
    <Badge variant={RUN_VARIANTS[status]} className={cn('gap-1.5', className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {RUN_LABELS[status]}
    </Badge>
  );
}
