/**
 * Property-based testing configuration + helper for `foundation-discovery-core`.
 *
 * The project standard is a minimum of **100 runs** per property (design →
 * Testing Strategy). `fcConfig` is the shared baseline; `propertyTest` binds a
 * fast-check property to Vitest's `test` with that baseline applied.
 *
 * Each property test in the codebase MUST additionally carry a tag comment:
 *   `// Feature: foundation-discovery-core, Property {n}: {property title}`
 */
import { test } from 'vitest';
import fc from 'fast-check';

/**
 * Default fast-check parameters. The project mandates >= 100 runs for every
 * property test. Callers may override (e.g. raise `numRuns` for the dedup/SSRF
 * families) by passing `params` to {@link propertyTest} / {@link assertProperty}.
 */
export const fcConfig = { numRuns: 100 } as const satisfies fc.Parameters<unknown>;

/**
 * The minimum number of runs a property test must execute. Exposed so callers
 * can assert/raise the floor without duplicating the literal.
 */
export const MIN_PROPERTY_RUNS = 100 as const;

/**
 * Run a fast-check property with the project defaults merged in. Use inside a
 * Vitest test body when you need finer control than {@link propertyTest}.
 *
 * Accepts both synchronous and asynchronous properties; the returned value
 * (a `Promise` for async properties) should be awaited/returned by the caller.
 */
export function assertProperty<Ts>(
  property: fc.IRawProperty<Ts>,
  params?: fc.Parameters<Ts>,
): void | Promise<void> {
  return fc.assert(property, { ...fcConfig, ...params });
}

/**
 * Register a Vitest `test` that asserts a fast-check property using the shared
 * {@link fcConfig} baseline (>= 100 runs).
 *
 * @example
 * propertyTest(
 *   'normalize is idempotent',
 *   fc.property(arbUrl(), (u) => normalize(normalize(u)) === normalize(u)),
 * );
 */
export function propertyTest<Ts>(
  name: string,
  property: fc.IRawProperty<Ts>,
  params?: fc.Parameters<Ts>,
): void {
  test(name, () => assertProperty(property, params));
}
