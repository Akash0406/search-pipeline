/**
 * Barrel export for the full Drizzle schema.
 *
 * `drizzle.config.ts` points at this file; the drizzle client is instantiated
 * with `{ schema }` so the relational query API is available to repositories.
 */
export * from './enums.js';
export * from './identity.js';
export * from './role-profiles.js';
export * from './connectors.js';
export * from './opportunities.js';
export * from './state.js';
