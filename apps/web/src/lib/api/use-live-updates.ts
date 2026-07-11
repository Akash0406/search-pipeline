'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { liveEventSchema, type LiveEvent } from '@careerstack/contracts';
import { API_BASE_URL } from './client';
import { opportunityKeys } from './opportunities';
import { adminKeys } from './admin';
import { privacyKeys } from './privacy';

/** Backoff bounds for manual reconnection after a stream error. */
const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Subscribe to the server's live-updates stream (`GET /events`, Req 56) and
 * invalidate the affected TanStack Query caches so the dashboard, admin health,
 * and privacy/export views refresh live — no polling required.
 *
 * Behaviour:
 *  - Opens an {@link EventSource} with credentials (session cookie) so the
 *    stream is authenticated + per-user scoped server-side.
 *  - Maps each typed event to the relevant query keys and invalidates them.
 *  - Reconnects with exponential backoff + jitter on error, and tears the
 *    connection down on unmount (no leaks).
 *
 * Enable it only where a live signal is useful (pass `enabled: false` to opt
 * out, e.g. on public/signed-out surfaces).
 */
export function useLiveUpdates({ enabled = true }: { enabled?: boolean } = {}): void {
  const queryClient = useQueryClient();

  const handleEvent = React.useCallback(
    (event: LiveEvent) => {
      switch (event.type) {
        case 'run.status':
          // A connector run changed — refresh admin health/runs and, since
          // ingestion may have produced/updated rows, the explorer too.
          void queryClient.invalidateQueries({ queryKey: adminKeys.connectorHealth });
          void queryClient.invalidateQueries({ queryKey: adminKeys.runs });
          void queryClient.invalidateQueries({ queryKey: opportunityKeys.all });
          break;
        case 'opportunity.changed':
          void queryClient.invalidateQueries({ queryKey: opportunityKeys.all });
          break;
        case 'export.status':
          void queryClient.invalidateQueries({ queryKey: privacyKeys.export(event.exportId) });
          break;
        default:
          // Exhaustiveness guard: unknown events are ignored (forward-compatible).
          break;
      }
    },
    [queryClient],
  );

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let closed = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource(`${API_BASE_URL}/events`, { withCredentials: true });

      source.onopen = () => {
        attempts = 0; // Reset backoff once the stream is healthy.
      };

      source.onmessage = (message: MessageEvent<string>) => {
        // Ignore heartbeats / any payload that isn't a valid live event.
        let json: unknown;
        try {
          json = JSON.parse(message.data);
        } catch {
          return;
        }
        const parsed = liveEventSchema.safeParse(json);
        if (parsed.success) handleEvent(parsed.data);
      };

      source.onerror = () => {
        // EventSource will try to auto-reconnect, but to bound retries and add
        // jitter we close and schedule our own reconnect with backoff.
        source?.close();
        source = null;
        if (closed) return;
        attempts += 1;
        const base = Math.min(MIN_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
        const jitter = Math.random() * base * 0.25;
        reconnectTimer = setTimeout(connect, base + jitter);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
      source = null;
    };
  }, [enabled, handleEvent]);
}
