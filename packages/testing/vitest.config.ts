import { defineConfig, mergeConfig } from 'vitest/config';
import { baseVitestConfig } from './src/vitest-preset.js';

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      name: '@careerstack/testing',
    },
  }),
);
