'use client';

import * as React from 'react';
import { Activity, ClipboardList, FileWarning, ListChecks, ShieldAlert } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@careerstack/ui';
import type {
  ConnectorHealthItem,
  ConnectorRun,
  ParserFailureItem,
  ReviewQueueItem,
} from '@careerstack/contracts';
import { ApiError } from '@/lib/api/client';
import {
  useAdminRuns,
  useConnectorHealth,
  useParserFailures,
  useReviewQueue,
} from '@/lib/api/admin';
import { EmptyState, ErrorState } from '@/components/common/states';
import { DateTime } from '@/components/common/date-time';
import { SOURCE_TYPE_LABELS } from '@/lib/opportunity-options';
import { HealthBadge, RunStatusBadge } from './status-badges';

/** Friendly labels for the fixed review-queue reason vocabulary (Req 48.2). */
const REVIEW_REASON_LABELS: Record<ReviewQueueItem['reason'], string> = {
  validation_failed: 'Validation failed',
  parse_failed: 'Parse failed',
  uncertain_duplicate: 'Uncertain duplicate',
  uncertain_closure: 'Uncertain closure',
};

const PARSER_STATUS_LABELS: Record<ParserFailureItem['status'], string> = {
  validation_failed: 'Validation failed',
  parse_failed: 'Parse failed',
};

/** True when an error is an access-denial (403) from the admin API (Req 47.3). */
function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** Full-page access-denied state when the API rejects a non-admin (Req 47.3). */
function AccessDenied() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Admin access required"
      description="You don't have permission to view connector health. If you believe this is a mistake, contact an administrator."
    />
  );
}

/** A titled section wrapper with a consistent header + icon. */
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Loading skeleton rows for a table-ish section. */
function LoadingRows() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** A minimal, accessible table primitive shared across the admin sections. */
function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b bg-muted/40 text-left">{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className ?? ''}`}>{children}</td>;
}

/* ----------------------------- Sections ----------------------------- */

function ConnectorHealthSection() {
  const query = useConnectorHealth();
  const items = query.data?.items ?? [];

  return (
    <Section
      icon={Activity}
      title="Connector health"
      description="Current health per connection, with the last recorded reason and consecutive failures."
    >
      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState title="Couldn’t load connector health" onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No connections yet"
          description="Once sources are connected and running, their health appears here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item: ConnectorHealthItem) => (
            <li key={item.connectionId} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {item.displayName ?? SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType}
                </span>
                <HealthBadge status={item.healthStatus} />
              </div>
              <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-2">
                  <dt>Source</dt>
                  <dd className="text-foreground">
                    {SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Consecutive failures</dt>
                  <dd className="text-foreground">{item.consecutiveFailures}</dd>
                </div>
                {item.lastCheckedAt ? (
                  <div className="flex justify-between gap-2">
                    <dt>Last checked</dt>
                    <dd className="text-foreground">
                      <DateTime value={item.lastCheckedAt} />
                    </dd>
                  </div>
                ) : null}
                {item.lastHealthReason ? (
                  <p className="pt-1 text-foreground">{item.lastHealthReason}</p>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function RecentRunsSection() {
  const query = useAdminRuns();
  const runs = query.data?.runs ?? [];

  return (
    <Section
      icon={ClipboardList}
      title="Recent runs"
      description="The latest connector runs with item counts and failure reasons."
    >
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load runs" onRetry={() => void query.refetch()} />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No runs recorded"
          description="Connector runs will appear here as sources are polled."
        />
      ) : (
        <Table
          head={
            <tr>
              <Th>Status</Th>
              <Th>Started</Th>
              <Th>Discovered</Th>
              <Th>Fetched</Th>
              <Th>Parsed</Th>
              <Th>Persisted</Th>
              <Th>Failed</Th>
              <Th>Reason</Th>
            </tr>
          }
        >
          {runs.map((run: ConnectorRun) => (
            <tr key={run.id} className="border-b last:border-0 hover:bg-muted/30">
              <Td>
                <RunStatusBadge status={run.status} />
              </Td>
              <Td className="whitespace-nowrap">
                <DateTime value={run.startedAt} />
              </Td>
              <Td>{run.itemsDiscovered}</Td>
              <Td>{run.itemsFetched}</Td>
              <Td>{run.itemsParsed}</Td>
              <Td>{run.itemsPersisted}</Td>
              <Td className={run.itemsFailed > 0 ? 'font-medium text-destructive' : ''}>
                {run.itemsFailed}
              </Td>
              <Td className="max-w-xs truncate text-muted-foreground">
                {run.failureReason ?? '—'}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}

function ParserFailuresSection() {
  const query = useParserFailures();
  const items = query.data?.items ?? [];

  return (
    <Section
      icon={FileWarning}
      title="Parser failures"
      description="Records that failed parsing or validation, with their reasons."
    >
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load parser failures" onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileWarning}
          title="No parser failures"
          description="Parsing and validation are healthy — nothing to review here."
        />
      ) : (
        <Table
          head={
            <tr>
              <Th>Source</Th>
              <Th>Status</Th>
              <Th>Reason</Th>
              <Th>When</Th>
            </tr>
          }
        >
          {items.map((item: ParserFailureItem) => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
              <Td>{SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType}</Td>
              <Td>{PARSER_STATUS_LABELS[item.status]}</Td>
              <Td className="max-w-md truncate text-muted-foreground">
                {item.failureReason ?? '—'}
              </Td>
              <Td className="whitespace-nowrap">
                <DateTime value={item.createdAt} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}

function ReviewQueueSection() {
  const query = useReviewQueue();
  const items = query.data?.items ?? [];

  return (
    <Section
      icon={ListChecks}
      title="Review queue"
      description="Opportunities and duplicates awaiting a decision."
    >
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load the review queue" onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Review queue is empty"
          description="No records need manual review right now."
        />
      ) : (
        <Table
          head={
            <tr>
              <Th>Reason</Th>
              <Th>Source URL</Th>
              <Th>When</Th>
            </tr>
          }
        >
          {items.map((item: ReviewQueueItem) => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
              <Td>{REVIEW_REASON_LABELS[item.reason]}</Td>
              <Td className="max-w-md truncate">
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {item.sourceUrl}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Td>
              <Td className="whitespace-nowrap">
                <DateTime value={item.createdAt} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}

/**
 * Admin connector-health surface (Req 47, 48). Read-only operational view:
 * per-connection health, recent runs with counts + reasons, parser failures,
 * and the review queue. The route is admin-gated by middleware; if the API
 * still rejects the caller (403), a graceful access-denied state is shown
 * instead of a spinner or error (Req 47.3).
 */
export function ConnectorHealthClient() {
  const health = useConnectorHealth();

  // Any admin query returning 403 means this user isn't authorized — surface a
  // single, clear access-denied state rather than four error cards.
  if (isForbidden(health.error)) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <ConnectorHealthSection />
      <RecentRunsSection />
      <div className="grid gap-6 lg:grid-cols-2">
        <ParserFailuresSection />
        <ReviewQueueSection />
      </div>
    </div>
  );
}
