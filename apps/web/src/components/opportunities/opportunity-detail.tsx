'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Building2,
  CalendarClock,
  ExternalLink,
  MapPin,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@careerstack/ui';
import type { OpportunityDetail } from '@careerstack/contracts';
import { ApiError } from '@/lib/api/client';
import { useMe } from '@/lib/api/hooks';
import { useOpportunity } from '@/lib/api/opportunities';
import { ErrorState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { DateTime } from '@/components/common/date-time';
import {
  EMPLOYMENT_TYPE_LABELS,
  formatSalary,
  SENIORITY_LABELS,
  WORK_ARRANGEMENT_LABELS,
} from '@/lib/opportunity-options';
import { FirstPartyMarker } from './first-party-marker';
import { SaveDismissActions } from './save-dismiss-actions';
import { SanitizedHtml } from './sanitized-html';
import { SafeExternalLink, SourceHistory } from './source-history';

/** A labelled key/value fact in the detail sidebar. */
function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

function DetailContent({ opportunity, timezone }: { opportunity: OpportunityDetail; timezone?: string }) {
  const salary = formatSalary(opportunity.salary);
  // Spread-only prop so we never pass `timezone: undefined` (exactOptionalPropertyTypes).
  const tz = timezone ? { timezone } : {};
  // The primary "open original" target: the canonical (first-party) URL.
  const originalUrl = opportunity.canonicalUrl;
  // Requirement/skill-related evidence powers the Requirements tab (Req 45.2).
  const requirementEvidence = opportunity.evidence.filter((e) =>
    /requirement|skill|qualif/i.test(e.field),
  );

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link href="/app/opportunities">
            <ArrowLeft className="size-4" aria-hidden />
            Back to opportunities
          </Link>
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge canonical={opportunity.status} userState={opportunity.userState} />
              {opportunity.isFirstParty ? <FirstPartyMarker /> : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{opportunity.title}</h1>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="size-4" aria-hidden />
              {opportunity.company}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <SaveDismissActions
              opportunityId={opportunity.id}
              title={opportunity.title}
              userState={opportunity.userState}
              className="flex items-center gap-2"
            />
            <Button asChild size="sm">
              <a href={originalUrl} target="_blank" rel="noopener noreferrer">
                Open original
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        <Tabs defaultValue="overview" className="min-w-0">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="sources">Sources &amp; history</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            {opportunity.description ? (
              <SanitizedHtml html={opportunity.description} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No description was provided by the source for this opportunity.
              </p>
            )}
          </TabsContent>

          <TabsContent value="requirements" className="pt-4">
            {requirementEvidence.length > 0 ? (
              <ul className="space-y-2">
                {requirementEvidence.map((item, index) => (
                  <li key={`${item.field}-${index}`} className="rounded-lg border p-3 text-sm">
                    <span className="font-mono text-xs font-medium">{item.field}</span>
                    {item.sourceText ? (
                      <blockquote className="mt-2 border-l-2 pl-3 text-muted-foreground">
                        “{item.sourceText}”
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No structured requirements were extracted for this opportunity. See the full
                description in the Overview tab.
              </p>
            )}
          </TabsContent>

          <TabsContent value="company" className="space-y-3 pt-4">
            <p className="text-sm">
              <span className="font-medium">{opportunity.company}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Roles are sourced from the contributing systems below. First-party sources come
              directly from the employer.
            </p>
            <ul className="space-y-1 text-sm">
              {opportunity.sources.map((source) => (
                <li key={source.id} className="flex items-center gap-2">
                  <SafeExternalLink href={source.sourceUrl}>
                    {(() => {
                      try {
                        return new URL(source.sourceUrl).host;
                      } catch {
                        return source.sourceUrl;
                      }
                    })()}
                  </SafeExternalLink>
                  {source.isFirstParty ? <FirstPartyMarker /> : null}
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="sources" className="pt-4">
            <SourceHistory sources={opportunity.sources} evidence={opportunity.evidence} />
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key facts</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {opportunity.locations.length > 0 ? (
                  <Fact icon={MapPin} label="Location">
                    {opportunity.locations.join(', ')}
                    {opportunity.workArrangement
                      ? ` · ${WORK_ARRANGEMENT_LABELS[opportunity.workArrangement]}`
                      : ''}
                  </Fact>
                ) : null}
                {opportunity.employmentType ? (
                  <Fact icon={Briefcase} label="Employment type">
                    {EMPLOYMENT_TYPE_LABELS[opportunity.employmentType]}
                    {opportunity.seniority
                      ? ` · ${SENIORITY_LABELS[opportunity.seniority]}`
                      : ''}
                  </Fact>
                ) : null}
                {salary ? (
                  <Fact icon={Banknote} label="Salary">
                    {salary}
                  </Fact>
                ) : null}
                <Separator />
                {opportunity.postedAt ? (
                  <Fact icon={CalendarClock} label="Posted">
                    <DateTime value={opportunity.postedAt} mode="absolute" {...tz} />
                  </Fact>
                ) : null}
                <Fact icon={CalendarClock} label="First seen">
                  <DateTime value={opportunity.firstSeenAt} mode="absolute" {...tz} />
                </Fact>
                <Fact icon={CalendarClock} label="Last updated">
                  <DateTime value={opportunity.lastUpdatedAt} {...tz} />
                </Fact>
                {opportunity.closingAt ? (
                  <Fact icon={CalendarClock} label="Closes">
                    <DateTime value={opportunity.closingAt} mode="absolute" {...tz} />
                  </Fact>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          {/* Reserved region for future match/analysis (Req 45.5) — no such
              content is produced or displayed in this slice. */}
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Sparkles className="size-5" aria-hidden />
              </div>
              <p className="text-sm font-medium">AI match analysis</p>
              <p className="text-xs text-muted-foreground">
                Personalized fit scoring and analysis are coming soon.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Opportunity detail view (Req 45). Fetches the full detail (description +
 * sources + evidence) and renders loading / not-found / error states before
 * showing the content. All timestamps use the user's timezone with the exact
 * value on demand (Req 46.3).
 */
export function OpportunityDetailView({ id }: { id: string }) {
  const me = useMe();
  const query = useOpportunity(id);

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/app/opportunities">
            <ArrowLeft className="size-4" aria-hidden />
            Back to opportunities
          </Link>
        </Button>
        <ErrorState
          title={notFound ? 'Opportunity not found' : 'Couldn’t load this opportunity'}
          description={
            notFound
              ? 'This opportunity doesn’t exist or is no longer available.'
              : 'We hit a snag loading this opportunity. Please try again.'
          }
          {...(notFound ? {} : { onRetry: () => void query.refetch() })}
        />
      </div>
    );
  }

  if (!query.data) return null;

  return <DetailContent opportunity={query.data} {...(me.data?.timezone ? { timezone: me.data.timezone } : {})} />;
}
