/**
 * Connector-type metadata + config validation (Req 20–23).
 *
 * Display names and per-type config requirements are derived here from the
 * connector registry (`@careerstack/connectors`). The registry is the source of
 * truth for WHICH connectors exist and their `isFirstParty` flag; this module
 * adds the human-facing display name and the config-field validation each type
 * needs before a connection is created:
 *   - ATS (greenhouse/lever/ashby) → a board `slug`
 *   - jsonld                       → a career-page `url`
 *   - manual_url                   → a single posting `url`
 */
import { createDefaultRegistry, type SourceType } from '@careerstack/connectors';

/** Human-facing names for the connector types registered in this slice. */
const DISPLAY_NAMES: Record<SourceType, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  jsonld: 'Company Career Page (JSON-LD)',
  manual_url: 'Manual URL',
  gmail: 'Gmail', // RESERVED (never registered in this slice)
};

/** Connector types that fetch from an official ATS board keyed by a slug. */
const ATS_SOURCE_TYPES: ReadonlySet<SourceType> = new Set(['greenhouse', 'lever', 'ashby']);

/** One shared registry instance — pure, framework-free, cheap to build once. */
const registry = createDefaultRegistry();

export interface ConnectorTypeMeta {
  sourceType: SourceType;
  displayName: string;
  isFirstParty: boolean;
}

/** The connector types available to connect (excludes reserved/unregistered). */
export function availableConnectorTypes(): ConnectorTypeMeta[] {
  return registry.sourceTypes().map((sourceType) => ({
    sourceType,
    displayName: DISPLAY_NAMES[sourceType],
    isFirstParty: registry.require(sourceType).isFirstParty,
  }));
}

/** Metadata for a single source type, or null when it is not registered. */
export function connectorMeta(sourceType: SourceType): ConnectorTypeMeta | null {
  const connector = registry.get(sourceType);
  if (!connector) return null;
  return {
    sourceType,
    displayName: DISPLAY_NAMES[sourceType],
    isFirstParty: connector.isFirstParty,
  };
}

/** Result of validating a connection config for a given source type. */
export type ConfigValidation =
  | { ok: true; config: Record<string, unknown>; isFirstParty: boolean; displayName: string }
  | { ok: false; message: string };

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isValidUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validate the config for a connection of `sourceType`. Rejects unregistered /
 * reserved types and enforces the required config field per connector family.
 */
export function validateConnectionConfig(
  sourceType: SourceType,
  config: Record<string, unknown>,
): ConfigValidation {
  const meta = connectorMeta(sourceType);
  if (!meta) {
    return { ok: false, message: `Unsupported connector type "${sourceType}".` };
  }

  if (ATS_SOURCE_TYPES.has(sourceType)) {
    if (!isNonEmptyString(config.slug)) {
      return { ok: false, message: `A board "slug" is required for ${meta.displayName}.` };
    }
    return {
      ok: true,
      config: { ...config, slug: config.slug.trim() },
      isFirstParty: meta.isFirstParty,
      displayName: meta.displayName,
    };
  }

  if (sourceType === 'jsonld') {
    const url = config.url ?? config.pageUrl;
    if (!isValidUrl(url)) {
      return { ok: false, message: 'A valid career-page "url" is required.' };
    }
    return {
      ok: true,
      config: { ...config, url },
      isFirstParty: meta.isFirstParty,
      displayName: meta.displayName,
    };
  }

  if (sourceType === 'manual_url') {
    if (!isValidUrl(config.url)) {
      return { ok: false, message: 'A valid job posting "url" is required.' };
    }
    return {
      ok: true,
      config: { ...config, url: config.url },
      isFirstParty: meta.isFirstParty,
      displayName: meta.displayName,
    };
  }

  return { ok: false, message: `Unsupported connector type "${sourceType}".` };
}
