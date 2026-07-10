/**
 * `@careerstack/shared` — pure domain logic: normalization, deduplication,
 * canonicalization and shared errors.
 *
 * Boundary rule: this package MUST stay free of framework/adapter imports
 * (NestJS, Fastify, Next.js, Drizzle, ioredis) so it remains property-testable.
 * Domain implementations arrive in later tasks; this placeholder keeps the
 * package valid.
 */
export const SHARED_PACKAGE = '@careerstack/shared' as const;
