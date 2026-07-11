/**
 * `@careerstack/contracts` — shared Zod request/response schemas, inferred TS
 * types, the explorer URL-state codec, and the OpenAPI document builder.
 *
 * This package is the single source of truth for API I/O (Design API §7). It is
 * intentionally framework-agnostic: no NestJS/Fastify/Next/Drizzle imports — only
 * the wire types.
 */
export const CONTRACTS_PACKAGE = '@careerstack/contracts' as const;

// Cross-cutting primitives
export * from './common/enums.js';
export * from './common/envelopes.js';
export * from './common/opportunity.js';

// Resource DTOs
export * from './auth.js';
export * from './me.js';
export * from './role-profiles.js';
export * from './connections.js';
export * from './opportunities.js';
export * from './admin.js';
export * from './privacy.js';
export * from './events.js';

// Explorer filter/sort state + URL codec
export * from './explorer.js';

// OpenAPI document builder
export * from './openapi.js';
