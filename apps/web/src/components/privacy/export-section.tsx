'use client';

import * as React from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  toast,
  type BadgeProps,
} from '@careerstack/ui';
import type { ExportStatus } from '@careerstack/contracts';
import { ApiError } from '@/lib/api/client';
import { useExportStatus, useRequestExport } from '@/lib/api/privacy';
import { DateTime } from '@/components/common/date-time';

/** Remember the most recent export so a page refresh keeps tracking it. */
const EXPORT_STORAGE_KEY = 'careerstack:last-export-id';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const STATUS_VARIANTS: Record<ExportStatus, BadgeVariant> = {
  pending: 'muted',
  processing: 'warning',
  ready: 'success',
  failed: 'destructive',
};

const STATUS_LABELS: Record<ExportStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
};

/**
 * Data export (Req 49, 56). Triggers an async export, polls its status while it
 * prepares, and reveals an owner-only download link once ready. The live status
 * is also nudged by SSE invalidation, so it updates without waiting for the
 * next poll.
 */
export function ExportSection() {
  const [exportId, setExportId] = React.useState<string | undefined>(undefined);

  // Restore the last-known export id after mount (client-only).
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(EXPORT_STORAGE_KEY);
      if (stored) setExportId(stored);
    } catch {
      /* localStorage unavailable — start fresh. */
    }
  }, []);

  const request = useRequestExport();
  const status = useExportStatus(exportId);

  const onRequest = () => {
    request.mutate(undefined, {
      onSuccess: (result) => {
        setExportId(result.exportId);
        try {
          window.localStorage.setItem(EXPORT_STORAGE_KEY, result.exportId);
        } catch {
          /* ignore persistence failure */
        }
        toast.success('Export requested', {
          description: 'We’re assembling your data. This can take a few minutes.',
        });
      },
      onError: (error) => {
        toast.error('Couldn’t start the export', {
          description: error instanceof ApiError ? error.message : 'Please try again in a moment.',
        });
      },
    });
  };

  const current = status.data;
  const isPreparing = current?.status === 'pending' || current?.status === 'processing';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="size-4 text-muted-foreground" aria-hidden />
          Export your data
        </CardTitle>
        <CardDescription>
          Download everything we hold about you: your profile, role profiles, saved and dismissed
          opportunities, and connected-source configuration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current ? (
          <div className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Latest export</span>
                <Badge variant={STATUS_VARIANTS[current.status]} className="gap-1.5">
                  {isPreparing ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  ) : (
                    <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
                  )}
                  {STATUS_LABELS[current.status]}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                Requested <DateTime value={current.requestedAt} />
              </span>
            </div>

            {current.status === 'ready' && current.downloadUrl ? (
              <div className="mt-3">
                <Button asChild size="sm">
                  <a href={current.downloadUrl} download>
                    <Download className="size-4" aria-hidden />
                    Download export
                  </a>
                </Button>
                {current.completedAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ready <DateTime value={current.completedAt} /> · link expires shortly for your
                    security.
                  </p>
                ) : null}
              </div>
            ) : null}

            {current.status === 'failed' ? (
              <p className="mt-2 text-xs text-destructive">
                The export failed to generate. You can request a new one below.
              </p>
            ) : null}

            {isPreparing ? (
              <p className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                Preparing your export… this page updates automatically.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button onClick={onRequest} disabled={request.isPending}>
            {request.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Requesting…
              </>
            ) : (
              'Request export'
            )}
          </Button>
          {exportId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void status.refetch()}
              disabled={status.isFetching}
            >
              <RefreshCw
                className={`size-4 ${status.isFetching ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Refresh status
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
