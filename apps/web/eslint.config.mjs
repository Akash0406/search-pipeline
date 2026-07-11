// @ts-check
import globals from 'globals';
import rootConfig from '../../eslint.config.mjs';

/**
 * Web app lint config. Reuses the monorepo base (TypeScript + Prettier) and
 * adds browser globals for client components. Next 16 removed `next lint`, so
 * linting runs through the ESLint CLI directly (`eslint .`).
 */
export default [
  ...rootConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
  },
  {
    ignores: ['.next/**', 'next-env.d.ts', 'public/**', 'dist/**'],
  },
];
