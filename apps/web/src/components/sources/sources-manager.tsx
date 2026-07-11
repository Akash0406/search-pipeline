'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Link as LinkIcon, Plus } from 'lucide-react';
import type { Connection } from '@careerstack/contracts';
import { Button, Skeleton } from '@careerstack/ui';
import { useMe } from '@/lib/api/hooks';
import { useConnectionList } from '@/lib/api/connections';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ConnectionCard } from './connection-card';
import { ConnectionWizard } from './connection-wizard';
import { ConnectionRunsDialog } from './connection-runs-dialog';
import { ManualUrlDialog } from './manual-url-dialog';
import { RemoveConnectionDialog } from './remove-connection-dialog';

function ConnectionsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Sources / connections manager (Req 20–26, Design §8 `/app/sources`). Lists
 * connections with status/health/last-run and run/pause/remove actions, plus
 * the add-source wizard and the one-off "Save a URL" flow. Reads `?connect=1`
 * and `?save-url=1` so dashboard quick actions and the command palette can deep
 * link straight into these flows.
 */
export function SourcesManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const me = useMe();
  const query = useConnectionList();

  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [manualUrlOpen, setManualUrlOpen] = React.useState(false);
  const [runsFor, setRunsFor] = React.useState<Connection | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<Connection | null>(null);

  const timezone = me.data?.timezone;

  // Deep-link support: open a flow from a query param, then strip it so the
  // dialog doesn't reopen on refresh/back.
  React.useEffect(() => {
    if (searchParams.get('connect') === '1') {
      setWizardOpen(true);
      router.replace('/app/sources');
    } else if (searchParams.get('save-url') === '1') {
      setManualUrlOpen(true);
      router.replace('/app/sources');
    }
  }, [searchParams, router]);

  const connections = query.data?.connections ?? [];
  // Removed connections are retained server-side but shown last (or hidden).
  const visible = connections.filter((c) => c.status !== 'removed');

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="text-sm text-muted-foreground">
            Company career pages and ATS boards you’re tracking for new opportunities.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setManualUrlOpen(true)}>
            <LinkIcon className="size-4" aria-hidden />
            Save a URL
          </Button>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Connect a source
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <ConnectionsSkeleton />
      ) : query.isError ? (
        <ErrorState
          title="Couldn’t load your sources"
          description="We hit a snag loading your connections. Please try again."
          onRetry={() => void query.refetch()}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No connected sources yet"
          description="Add a company’s Greenhouse, Lever, or Ashby board — or a career-page URL — and we’ll discover and keep opportunities up to date."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => setWizardOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Connect a source
              </Button>
              <Button variant="outline" onClick={() => setManualUrlOpen(true)}>
                <LinkIcon className="size-4" aria-hidden />
                Save a URL
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visible.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              {...(timezone ? { timezone } : {})}
              onViewRuns={setRunsFor}
              onRemove={setRemoveTarget}
            />
          ))}
        </div>
      )}

      <ConnectionWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <ManualUrlDialog open={manualUrlOpen} onOpenChange={setManualUrlOpen} />
      <ConnectionRunsDialog
        connection={runsFor}
        onOpenChange={(open) => !open && setRunsFor(null)}
        {...(timezone ? { timezone } : {})}
      />
      <RemoveConnectionDialog
        connection={removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      />
    </>
  );
}
