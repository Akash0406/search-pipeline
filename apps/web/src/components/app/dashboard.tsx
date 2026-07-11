'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  Link as LinkIcon,
  Radar,
  Sparkles,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';
import type { Connection, OpportunityListItem } from '@careerstack/contracts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  cn,
} from '@careerstack/ui';
import { useMe, useRoleProfiles } from '@/lib/api/hooks';
import { useConnectionList } from '@/lib/api/connections';
import { useOpportunities } from '@/lib/api/opportunities';
import { StatusBadge } from '@/components/common/status-badge';
import { DateTime } from '@/components/common/date-time';
import { EmptyState, ErrorState } from '@/components/common/states';
import { HEALTH_META, connectionLabel } from '@/lib/connection-options';
import { formatLocations, formatSalary } from '@/lib/opportunity-options';

/** Count derived from the first page of an infinite explorer query. */
function formatFirstPageCount(count: { value: number; hasMore: boolean }): string {
  return `${count.value}${count.hasMore ? '+' : ''}`;
}

/* ----------------------------- Welcome header ---------------------------- */

function WelcomeHeader({ lastDiscovery }: { lastDiscovery: string | undefined }) {
  const me = useMe();
  const profiles = useRoleProfiles();

  const name = me.data?.displayName || me.data?.email?.split('@')[0];
  const active = profiles.data?.profiles.find((p) => p.isActive);

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {me.isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : name ? (
            `Welcome back, ${name}`
          ) : (
            'Welcome back'
          )}
        </h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {active ? (
            <span className="inline-flex items-center gap-1.5">
              <UserCircle className="size-4" aria-hidden />
              Active profile: <span className="font-medium text-foreground">{active.name}</span>
            </span>
          ) : (
            <span>Set an active role profile to focus discovery.</span>
          )}
          {lastDiscovery ? (
            <>
              <span aria-hidden>·</span>
              <span>
                Last discovery <DateTime value={lastDiscovery} mode="relative" />
              </span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------- KPI cards ------------------------------- */

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  comingSoon = false,
  loading = false,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  hint?: string;
  href?: string;
  comingSoon?: boolean;
  loading?: boolean;
}) {
  const body = (
    <Card
      className={cn(
        'h-full transition-shadow',
        href && !comingSoon && 'hover:shadow-md',
        comingSoon && 'opacity-80',
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {comingSoon ? (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Coming soon
            </Badge>
          ) : loading ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums">{value ?? '—'}</p>
          )}
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span
          aria-hidden
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            comingSoon ? 'bg-muted text-muted-foreground' : 'bg-primary/12 text-primary',
          )}
        >
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );

  if (href && !comingSoon) {
    return (
      <Link
        href={href}
        className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {body}
      </Link>
    );
  }
  return body;
}

/* -------------------------- Priority opportunities ------------------------ */

function PriorityRow({ item, timezone }: { item: OpportunityListItem; timezone?: string }) {
  const location = formatLocations(item.locations);
  const salary = formatSalary(item.salary);
  return (
    <li>
      <Link
        href={`/app/opportunities/${item.id}`}
        className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.company}
            {location ? ` · ${location}` : ''}
            {salary ? ` · ${salary}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge canonical={item.status} userState={item.userState} />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            <DateTime
              value={item.firstSeenAt}
              {...(timezone ? { timezone } : {})}
              mode="relative"
            />
          </span>
        </div>
      </Link>
    </li>
  );
}

function PriorityOpportunities({ timezone }: { timezone?: string }) {
  const query = useOpportunities({ sort: 'newest' });
  const items = query.data?.pages[0]?.data.slice(0, 6) ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Priority opportunities</CardTitle>
          <CardDescription>The most recently discovered roles for you.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-primary">
          <Link href="/app/opportunities">
            View all
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState title="Couldn’t load opportunities" onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="No opportunities yet"
            description="Connect a source and we’ll start discovering roles. New matches show up here automatically."
            action={
              <Button asChild>
                <Link href="/app/sources?connect=1">Connect a source</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <PriorityRow key={item.id} item={item} {...(timezone ? { timezone } : {})} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Source status card -------------------------- */

function SourceStatus({ timezone }: { timezone?: string }) {
  const query = useConnectionList();
  const connections = (query.data?.connections ?? []).filter((c) => c.status !== 'removed');

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Sources</CardTitle>
          <CardDescription>Health of the boards and pages you track.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-primary">
          <Link href="/app/sources">
            Manage
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState title="Couldn’t load sources" onRetry={() => void query.refetch()} />
        ) : connections.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No sources connected"
            description="Add an ATS board or career page to start discovering opportunities."
            action={
              <Button asChild>
                <Link href="/app/sources?connect=1">Connect a source</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {connections.slice(0, 5).map((connection: Connection) => {
              const health = HEALTH_META[connection.healthStatus];
              return (
                <li
                  key={connection.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{connectionLabel(connection)}</p>
                    <p className="text-xs text-muted-foreground">
                      {connection.lastRun ? (
                        <>
                          Last run{' '}
                          <DateTime
                            value={connection.lastRun.finishedAt ?? connection.lastRun.startedAt}
                            {...(timezone ? { timezone } : {})}
                            mode="relative"
                          />
                        </>
                      ) : (
                        'No runs yet'
                      )}
                    </p>
                  </div>
                  <Badge variant={health.variant} className="shrink-0">
                    {health.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Quick actions ---------------------------- */

const QUICK_ACTIONS: { href: string; icon: LucideIcon; title: string; description: string }[] = [
  {
    href: '/app/profiles/new',
    icon: UserCircle,
    title: 'Add a role profile',
    description: 'Define the titles, skills, and locations you care about.',
  },
  {
    href: '/app/sources?connect=1',
    icon: Building2,
    title: 'Connect a source',
    description: 'Track a company’s Greenhouse, Lever, or Ashby board — or a career page.',
  },
  {
    href: '/app/sources?save-url=1',
    icon: LinkIcon,
    title: 'Save a URL',
    description: 'Capture a single job-posting link we haven’t discovered yet.',
  },
  {
    href: '/app/opportunities',
    icon: Radar,
    title: 'Browse opportunities',
    description: 'Filter, sort, and save the roles worth a closer look.',
  },
];

function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {QUICK_ACTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary"
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground">{description}</span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Dashboard ------------------------------ */

/**
 * Authenticated dashboard (Req 2, 3, Design §8 `/app`). Real data via TanStack
 * Query with loading/empty/error states; metrics that belong to future slices
 * (matching, applications, events) are shown as clearly-labelled "coming soon"
 * affordances rather than fabricated numbers.
 */
export function Dashboard() {
  const me = useMe();
  const connectionsQuery = useConnectionList();
  const newToday = useOpportunities({ freshness: '24h', sort: 'newlyDiscovered' });
  const saved = useOpportunities({ state: 'saved' });

  const timezone = me.data?.timezone;

  const activeConnections = (connectionsQuery.data?.connections ?? []).filter(
    (c) => c.status === 'active',
  );

  // Best-effort "last discovery" = the most recent completed run across sources.
  const lastDiscovery = (connectionsQuery.data?.connections ?? [])
    .map((c) => c.lastRun?.finishedAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  const newTodayCount = formatFirstPageCount({
    value: newToday.data?.pages[0]?.data.length ?? 0,
    hasMore: newToday.data?.pages[0]?.page.hasMore ?? false,
  });
  const savedCount = formatFirstPageCount({
    value: saved.data?.pages[0]?.data.length ?? 0,
    hasMore: saved.data?.pages[0]?.page.hasMore ?? false,
  });

  return (
    <>
      <WelcomeHeader lastDiscovery={lastDiscovery} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Sparkles}
          label="New in last 24h"
          value={newTodayCount}
          href="/app/opportunities?freshness=24h&sort=newlyDiscovered"
          loading={newToday.isLoading}
        />
        <KpiCard
          icon={Building2}
          label="Sources connected"
          value={String(activeConnections.length)}
          href="/app/sources"
          loading={connectionsQuery.isLoading}
        />
        <KpiCard
          icon={Radar}
          label="Saved"
          value={savedCount}
          href="/app/opportunities?state=saved"
          loading={saved.isLoading}
        />
        <KpiCard
          icon={Briefcase}
          label="High matches"
          comingSoon
          hint="Arrives with the matching engine."
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <KpiCard
          icon={CalendarClock}
          label="Upcoming events"
          comingSoon
          hint="Interview and event tracking is on the way."
        />
        <KpiCard
          icon={Bell}
          label="Follow-ups"
          comingSoon
          hint="Alerts and reminders arrive in a later release."
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PriorityOpportunities {...(timezone ? { timezone } : {})} />
        </div>
        <div className="space-y-6">
          <SourceStatus {...(timezone ? { timezone } : {})} />
          <QuickActions />
        </div>
      </div>
    </>
  );
}
