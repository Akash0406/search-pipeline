/**
 * API entrypoint — bootstraps NestJS on the Fastify adapter.
 *
 * - Registers `@fastify/cookie` (signed) so auth flows can read/write cookies.
 * - Sets the global `/api/v1` prefix, excluding the health probes.
 * - Assigns a per-request id (used as the correlation id and echoed in errors).
 *
 * The database pool connects lazily, so `bootstrap()` registers all routes and
 * begins listening without requiring a live database.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { loadConfig } from '@careerstack/config';
import { generateCorrelationId } from '@careerstack/observability';
import { AppModule } from './app.module.js';
import { API_PREFIX } from './common/constants.js';

export async function bootstrap(): Promise<NestFastifyApplication> {
  const config = loadConfig();

  const adapter = new FastifyAdapter({
    genReqId: () => generateCorrelationId(),
    trustProxy: true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  await app.register(fastifyCookie, { secret: config.auth.session.secret });

  app.setGlobalPrefix(API_PREFIX, {
    exclude: ['health/live', 'health/ready'],
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
  return app;
}

// Auto-run when executed directly (node dist/main.js). Guarded so importing this
// module for its exports does not start a server.
if (process.env.CAREERSTACK_API_BOOTSTRAP !== 'off') {
  bootstrap().catch((error: unknown) => {
    console.error('[api] failed to start', error);
    process.exit(1);
  });
}
