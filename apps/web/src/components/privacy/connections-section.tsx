'use client';

import * as React from 'react';
import { Link2Off, Loader2, Plug } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  toast,
} from '@careerstack/ui';
import type { Connection } from '@careerstack/contracts';
import { ApiError } from '@/lib/api/client';
import { useConnections, useDisconnectConnection } from '@/lib/api/privacy';
import { EmptyState, ErrorState } from '@/components/common/states';
import { SOURCE_TYPE_LABELS } from '@/lib/opportunity-options';

/** Best-effort human label for a connection from its source type + config. */
function connectionLabel(connection: Connection): string {
  const base = SOURCE_TYPE_LABELS[connection.sourceType] ?? connection.sourceType;
  const cfg = connection.config as Record<string, unknown>;
  const hint =
    (typeof cfg.displayName === 'string' && cfg.displayName) ||
    (typeof cfg.board === 'string' && cfg.board) ||
    (typeof cfg.slug === 'string' && cfg.slug) ||
    (typeof cfg.domain === 'string' && cfg.domain) ||
    (typeof cfg.url === 'string' && cfg.url) ||
    undefined;
  return hint ? `${base} · ${hint}` : base;
}

/**
 * Disconnect OAuth sources (Req 51). Lists connected sources and lets the user
 * disconnect one behind an explicit confirmation dialog that makes clear
 * previously ingested opportunities remain accessible (Req 51.3, destructive
 * confirmation Req 14).
 */
export function ConnectionsSection() {
  const query = useConnections();
  const disconnect = useDisconnectConnection();
  const [target, setTarget] = React.useState<Connection | null>(null);

  const connections = query.data?.connections ?? [];

  const onConfirm = () => {
    if (!target) return;
    const label = connectionLabel(target);
    disconnect.mutate(target.id, {
      onSuccess: () => {
        toast.success('Source disconnected', {
          description: `${label} won’t be scheduled anymore. Opportunities already found stay accessible.`,
        });
        setTarget(null);
      },
      onError: (error) => {
        toast.error('Couldn’t disconnect the source', {
          description:
            error instanceof ApiError ? error.message : 'Please try again in a moment.',
        });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="size-4 text-muted-foreground" aria-hidden />
          Connected sources
        </CardTitle>
        <CardDescription>
          Disconnect a source to revoke its access and stop future runs. Opportunities already
          discovered from it stay accessible unless you delete them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState title="Couldn’t load your sources" onRetry={() => void query.refetch()} />
        ) : connections.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No connected sources"
            description="When you connect a company board or career page, it appears here so you can manage access."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {connections.map((connection) => (
              <li
                key={connection.id}
                className="flex items-center justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{connectionLabel(connection)}</p>
                  <p className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="mr-2">
                      {connection.status}
                    </Badge>
                    {connection.consecutiveFailures > 0
                      ? `${connection.consecutiveFailures} recent failures`
                      : 'Healthy'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTarget(connection)}
                  disabled={connection.status === 'removed'}
                >
                  <Link2Off className="size-4" aria-hidden />
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect “{target ? connectionLabel(target) : ''}”?</DialogTitle>
            <DialogDescription>
              We’ll revoke this source’s authorization and stop scheduling new runs. Opportunities
              already discovered from it stay accessible — nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={disconnect.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={disconnect.isPending}>
              {disconnect.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Disconnecting…
                </>
              ) : (
                'Disconnect source'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
