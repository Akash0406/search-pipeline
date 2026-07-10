/**
 * `@careerstack/connectors` — the `OpportunityConnector` interface, registry
 * and concrete source connectors (Greenhouse/Lever/Ashby/JSON-LD/manual-URL).
 *
 * Boundary rule: this package stays free of framework/adapter imports
 * (NestJS, Fastify, Next.js, Drizzle, ioredis); connectors only reach the
 * network through an injected SafeFetcher (via {@link ConnectorContext}).
 */
export const CONNECTORS_PACKAGE = '@careerstack/connectors' as const;

// Core framework types (Task 8.1).
export type {
  SourceType,
  ExtractionMethod,
  DiscoveryRef,
  EvidenceValue,
  ParsedOpportunity,
  ParsedSalary,
  ClosureSignal,
  Checkpoint,
  HealthStatus,
  ConnectorContext,
  OpportunityConnector,
  FetchResult,
  SafeFetchOptions,
  SafeFetcher,
} from './types.js';

// Evidence helpers enforcing the no-fabrication rule (Req 34.3/34.4).
export {
  isAbsent,
  toSourceText,
  structuredEvidence,
  parserEvidence,
  structuredList,
  uncertainEvidence,
  type EvidenceOptions,
} from './evidence.js';

// Registry (Task 8.1) + default wiring.
export { ConnectorRegistry } from './registry.js';
export { createDefaultRegistry } from './default-registry.js';

// Base connector + checkpoint port + config helpers.
export {
  BaseConnector,
  type CheckpointStore,
  CHECKPOINT_STORE_CONFIG_KEY,
  requireStringConfig,
  optionalStringConfig,
} from './base-connector.js';

// Fetch-option builders.
export {
  buildFetchOptions,
  DEFAULT_FETCH_BOUNDS,
  JSON_CONTENT_TYPES,
  HTML_CONTENT_TYPES,
  JSONLD_CONTENT_TYPES,
  type FetchBounds,
} from './fetch-options.js';

// JSON-LD extraction/mapping (shared by JsonLd + ManualUrl connectors).
export {
  extractJsonLdJobPostings,
  isJobPosting,
  jobPostingExternalId,
  mapJsonLdJobPosting,
  type JsonLdNode,
} from './jsonld.js';

// Pure utilities.
export {
  bodyText,
  parseJsonBody,
  safeJsonParse,
  decodeHtmlEntities,
  toIsoDate,
  cleanString,
  syntheticJsonArtifact,
  resolveRawArtifactId,
  errorMessage,
  isParsedOpportunityEmpty,
} from './util.js';

// Concrete connectors (Tasks 8.2–8.6) and their pure mappers.
export { GreenhouseConnector, mapGreenhouseJob } from './connectors/greenhouse.js';
export { LeverConnector, mapLeverPosting } from './connectors/lever.js';
export { AshbyConnector, mapAshbyJob } from './connectors/ashby.js';
export {
  JsonLdConnector,
  JSONLD_NO_POSTING_MESSAGE,
} from './connectors/jsonld-connector.js';
export {
  ManualUrlConnector,
  parseHtmlBestEffort,
  resolveFirstPartyFromUrl,
} from './connectors/manual-url.js';
