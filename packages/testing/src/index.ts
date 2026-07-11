/**
 * `@careerstack/testing` — shared test harness for `foundation-discovery-core`.
 *
 * Provides:
 *  - `fcConfig` / `propertyTest` / `assertProperty` — fast-check property
 *    helpers with the project default of >= 100 runs.
 *  - `createFixtureLoader` — load recorded connector payload fixtures from disk.
 *  - Generic fast-check arbitraries (URLs, domains, IP ranges) plus documented
 *    extension points for the schema-dependent domain arbitraries.
 *
 * The shared Vitest config baseline is exposed via the `@careerstack/testing/vitest`
 * subpath export (see `./vitest-preset`).
 */
export const TESTING_PACKAGE = '@careerstack/testing' as const;

export { fcConfig, MIN_PROPERTY_RUNS, assertProperty, propertyTest } from './property.js';

export { createFixtureLoader, type FixtureLoader } from './fixtures.js';

export * from './arbitraries/index.js';

// Re-exported for convenience so consumers can `import { fc } from '@careerstack/testing'`
// instead of adding a separate fast-check import.
export { default as fc } from 'fast-check';
