/**
 * `@careerstack/connectors` — the `OpportunityConnector` interface, registry
 * and concrete source connectors (Greenhouse/Lever/Ashby/JSON-LD/manual-URL).
 *
 * Boundary rule: this package MUST stay free of framework/adapter imports
 * (NestJS, Fastify, Next.js, Drizzle, ioredis); connectors only reach the
 * network through an injected SafeFetcher. Implementations arrive in later
 * tasks; this placeholder keeps the package valid.
 */
export const CONNECTORS_PACKAGE = '@careerstack/connectors' as const;
