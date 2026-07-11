/**
 * Connector configuration metadata + labelling helpers for the sources manager
 * (Req 20–26). Frameworkless so both the wizard and the connection cards can
 * reuse them. The per-connector `configFields` describe exactly what the user
 * must enter to bind a connection (board slug / career-page URL).
 */
import type { Connection, HealthStatus, SourceType } from '@careerstack/contracts';
import type { BadgeProps } from '@careerstack/ui';
import { SOURCE_TYPE_LABELS } from '@/lib/opportunity-options';

export interface ConnectorConfigField {
  key: string;
  label: string;
  placeholder: string;
  help?: string;
  type?: 'text' | 'url';
}

/**
 * Source types the wizard can create a persistent connection for. `manual_url`
 * is a one-off submission handled separately; `gmail` is reserved/never built.
 */
export const CONNECTABLE_SOURCE_TYPES: readonly SourceType[] = [
  'greenhouse',
  'lever',
  'ashby',
  'jsonld',
];

/** Short description of each connector shown in the wizard picker. */
export const CONNECTOR_DESCRIPTIONS: Partial<Record<SourceType, string>> = {
  greenhouse: 'Official public Greenhouse job board.',
  lever: 'Official public Lever postings feed.',
  ashby: 'Official public Ashby job board.',
  jsonld: 'Any career page that publishes schema.org JobPosting data.',
  manual_url: 'Submit a single job-posting URL to capture one opportunity.',
};

/** The config a user must supply per connector type to create a connection. */
export const CONNECTOR_CONFIG_FIELDS: Partial<Record<SourceType, ConnectorConfigField[]>> = {
  greenhouse: [
    {
      key: 'slug',
      label: 'Board token',
      placeholder: 'e.g. airbnb',
      help: 'The identifier in the board URL: boards.greenhouse.io/<token>',
    },
  ],
  lever: [
    {
      key: 'slug',
      label: 'Company slug',
      placeholder: 'e.g. netflix',
      help: 'The identifier in the postings URL: jobs.lever.co/<slug>',
    },
  ],
  ashby: [
    {
      key: 'slug',
      label: 'Job board name',
      placeholder: 'e.g. ramp',
      help: 'The board name in the URL: jobs.ashbyhq.com/<name>',
    },
  ],
  jsonld: [
    {
      key: 'url',
      label: 'Career page URL',
      placeholder: 'https://company.com/careers',
      type: 'url',
      help: 'A public career page that publishes JSON-LD job postings.',
    },
  ],
};

/** Best-effort human label for a connection from its source type + config. */
export function connectionLabel(connection: Connection): string {
  const base = SOURCE_TYPE_LABELS[connection.sourceType] ?? connection.sourceType;
  return connection.displayName ?? `${base} · ${connectionTarget(connection) ?? base}`;
}

/** The config "target" (slug/url/domain) shown as the connection subtitle. */
export function connectionTarget(connection: Connection): string | undefined {
  const cfg = connection.config as Record<string, unknown>;
  const value =
    (typeof cfg.slug === 'string' && cfg.slug) ||
    (typeof cfg.board === 'string' && cfg.board) ||
    (typeof cfg.url === 'string' && cfg.url) ||
    (typeof cfg.domain === 'string' && cfg.domain) ||
    undefined;
  return value || undefined;
}

type BadgeVariant = NonNullable<BadgeProps['variant']>;

/** Colour + label for a connection's operational status (Req 25). */
export const CONNECTION_STATUS_META: Record<
  Connection['status'],
  { label: string; variant: BadgeVariant }
> = {
  active: { label: 'Active', variant: 'success' },
  paused: { label: 'Paused', variant: 'muted' },
  removed: { label: 'Removed', variant: 'outline' },
};

/** Colour + label for connector health (Req 24, 47). */
export const HEALTH_META: Record<HealthStatus, { label: string; variant: BadgeVariant }> = {
  healthy: { label: 'Healthy', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'warning' },
  failing: { label: 'Failing', variant: 'destructive' },
  unknown: { label: 'Unknown', variant: 'outline' },
};
