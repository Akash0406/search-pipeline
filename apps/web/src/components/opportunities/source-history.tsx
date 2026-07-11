import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge, cn } from '@careerstack/ui';
import type { Evidence, OpportunitySourceRef } from '@careerstack/contracts';
import { EXTRACTION_METHOD_LABELS, SOURCE_TYPE_LABELS } from '@/lib/opportunity-options';
import { FirstPartyMarker } from './first-party-marker';

/** External link that opens session-isolated in a new tab (Req 45.4). */
export function SafeExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {children}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

function confidencePct(confidence: number | undefined): string | undefined {
  if (confidence === undefined) return undefined;
  return `${Math.round(confidence * 100)}% confidence`;
}

/** One contributing source with its host, first-party marker, and safe link. */
function SourceItem({ source }: { source: OpportunitySourceRef }) {
  let host = source.sourceUrl;
  try {
    host = new URL(source.sourceUrl).host;
  } catch {
    /* keep the raw URL if it isn't parseable */
  }
  const confidence = confidencePct(source.confidence);

  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{SOURCE_TYPE_LABELS[source.sourceType]}</Badge>
        {source.isFirstParty ? <FirstPartyMarker /> : null}
        {confidence ? <span className="text-xs text-muted-foreground">{confidence}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <SafeExternalLink href={source.sourceUrl}>{host}</SafeExternalLink>
        {source.applyUrl ? (
          <SafeExternalLink href={source.applyUrl}>Apply link</SafeExternalLink>
        ) : null}
      </div>
    </li>
  );
}

/** One evidence record backing a single populated canonical fact (Req 45.2). */
function EvidenceItem({ evidence }: { evidence: Evidence }) {
  const confidence = confidencePct(evidence.confidence);
  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium">{evidence.field}</span>
        <Badge variant="outline">{EXTRACTION_METHOD_LABELS[evidence.method]}</Badge>
        {confidence ? <span className="text-xs text-muted-foreground">{confidence}</span> : null}
        {evidence.uncertain ? (
          <Badge variant="warning">Uncertain</Badge>
        ) : null}
      </div>
      {evidence.sourceText ? (
        <blockquote className="mt-2 border-l-2 pl-3 text-sm text-muted-foreground">
          “{evidence.sourceText}”
        </blockquote>
      ) : null}
    </li>
  );
}

/**
 * Sources and per-fact evidence for the detail view (Req 45.2/45.3). Lists the
 * contributing sources retained after dedup/merge — first-party contributors
 * visibly marked — followed by the evidence backing each populated canonical
 * fact (source text, extraction method, confidence).
 */
export function SourceHistory({
  sources,
  evidence,
}: {
  sources: OpportunitySourceRef[];
  evidence: Evidence[];
}) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="sources-heading" className="space-y-3">
        <h3 id="sources-heading" className="text-sm font-semibold">
          Contributing sources ({sources.length})
        </h3>
        <ul className="space-y-2">
          {sources.map((source) => (
            <SourceItem key={source.id} source={source} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="evidence-heading" className="space-y-3">
        <h3 id="evidence-heading" className="text-sm font-semibold">
          Evidence ({evidence.length})
        </h3>
        {evidence.length > 0 ? (
          <ul className="space-y-2">
            {evidence.map((item, index) => (
              <EvidenceItem key={`${item.field}-${item.rawArtifactId}-${index}`} evidence={item} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No per-fact evidence was recorded for this opportunity.
          </p>
        )}
      </section>
    </div>
  );
}
