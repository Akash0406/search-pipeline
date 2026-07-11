/**
 * Health endpoints:
 *   GET /health/live         — liveness: the process is up and serving.
 *   GET /health/ready        — readiness: the database is reachable.
 *   GET /health/dependencies — best-effort reachability of DB / Redis / S3.
 *
 * `live`/`ready` are excluded from the `/api/v1` prefix (load-balancer probes);
 * `dependencies` is served under the API prefix. All are public. Readiness
 * performs a lightweight `SELECT 1`; if the database is unreachable it reports
 * `not_ready` with HTTP 503 rather than throwing. `dependencies` probes each
 * backing service independently with a short timeout and NEVER throws — an
 * unreachable dependency is reported as `down`, and the overall status is 503
 * only when at least one dependency is down (Design Reliability §11).
 */
import { Controller, Get, Inject, HttpCode, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { sql } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import type { Config } from '@careerstack/config';
import type { Logger } from '@careerstack/observability';
import { CONFIG, DB, LOGGER } from '../common/di-tokens.js';
import { Public } from '../common/decorators.js';
import { DependencyProbe } from './dependency-probe.service.js';

/** Health of a single backing dependency. */
interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs: number;
}

/** Aggregate dependency-health payload. */
interface DependenciesResponse {
  status: 'ok' | 'degraded';
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
    storage: DependencyStatus;
  };
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(LOGGER) private readonly logger: Logger,
    private readonly probe: DependencyProbe,
  ) {}

  @Public()
  @Get('live')
  @HttpCode(200)
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async ready(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ status: 'ready' | 'not_ready' }> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ready' };
    } catch {
      void reply.status(503);
      return { status: 'not_ready' };
    }
  }

  @Public()
  @Get('dependencies')
  async dependencies(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<DependenciesResponse> {
    const [database, redis, storage] = await Promise.all([
      this.timed(() => this.db.execute(sql`select 1`)),
      this.timed(() => this.probe.pingRedis(this.config.redis.redisUrl)),
      this.timed(() => this.probe.headBucket(this.config.storage)),
    ]);

    const dependencies = { database, redis, storage };
    const allUp = Object.values(dependencies).every((d) => d.status === 'up');
    if (!allUp) {
      void reply.status(503);
      this.logger.warn('health.dependencies.degraded', { dependencies });
    }
    return { status: allUp ? 'ok' : 'degraded', dependencies };
  }

  /** Run a probe, measuring latency and mapping any failure to `down`. */
  private async timed(fn: () => Promise<unknown>): Promise<DependencyStatus> {
    const startedAt = Date.now();
    try {
      await fn();
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch {
      return { status: 'down', latencyMs: Date.now() - startedAt };
    }
  }
}
