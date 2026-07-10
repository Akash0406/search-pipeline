/**
 * `@careerstack/api` — NestJS + Fastify HTTP API (`/api/v1`).
 *
 * The runnable entrypoint is `main.ts` (`node dist/main.js`). This barrel
 * re-exports the app module and the API prefix for tooling/tests without
 * triggering server startup.
 */
export const API_APP = '@careerstack/api' as const;

export { AppModule } from './app.module.js';
export { API_PREFIX } from './common/constants.js';
