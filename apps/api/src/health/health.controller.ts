/**
 * Health endpoints (excluded from the `/api/v1` prefix):
 *   GET /health/live  — liveness: the process is up and serving.
 *   GET /health/ready — readiness: dependencies (database) are reachable.
 *
 * Both are public. Readiness performs a lightweight `SELECT 1`; if the database
 * is unreachable it reports `not_ready` with HTTP 503 rather than throwing.
 */
import { Controller, Get, Inject, HttpCode } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Res } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import { DB } from '../common/di-tokens.js';
import { Public } from '../common/decorators.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

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
}
