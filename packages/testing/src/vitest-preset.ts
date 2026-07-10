/**
 * Shared Vitest configuration baseline for `foundation-discovery-core` packages.
 *
 * Consumers extend it in their own `vitest.config.ts`:
 *
 * @example
 * import { defineConfig, mergeConfig } from 'vitest/config';
 * import { baseVitestConfig } from '@careerstack/testing/vitest';
 *
 * export default mergeConfig(
 *   baseVitestConfig,
 *   defineConfig({ test: { name: '@careerstack/shared' } }),
 * );
 */
import { defineConfig, type UserConfig } from 'vitest/config';

/**
 * The baseline Vitest config: Node environment, conventional test globs, and
 * globals enabled so `describe`/`it`/`expect` need no import.
 */
export const baseVitestConfig: UserConfig = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
    passWithNoTests: true,
    clearMocks: true,
  },
});

export default baseVitestConfig;
