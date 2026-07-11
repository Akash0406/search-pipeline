// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Modules that pure domain packages (`packages/shared`, `packages/connectors`)
 * MUST NOT import. Enforces the design "Boundary rule": pure domain logic stays
 * framework- and adapter-agnostic so it remains reusable and property-testable.
 */
const FORBIDDEN_DOMAIN_IMPORTS = {
  patterns: [
    {
      group: [
        '@nestjs',
        '@nestjs/*',
        'fastify',
        'fastify/*',
        'next',
        'next/*',
        'drizzle-orm',
        'drizzle-orm/*',
        'ioredis',
        'ioredis/*',
      ],
      message:
        'packages/shared and packages/connectors are pure domain layers and must not import NestJS, Fastify, Next.js, Drizzle, or ioredis. Put adapter code in apps/* or packages/database.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/.turbo/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Boundary rule enforcement for pure domain packages.
  {
    files: ['packages/shared/**/*.ts', 'packages/connectors/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', FORBIDDEN_DOMAIN_IMPORTS],
    },
  },
  prettier,
);
