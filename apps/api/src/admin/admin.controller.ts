/**
 * Admin connector-health routes (Design API §7, Capability H):
 *   GET /admin/connector-health — per-connection health + last reason (47.1)
 *   GET /admin/runs             — recent connector runs + counts/reasons (47.2)
 *   GET /admin/parser-failures  — parser/validation failures + reasons (48.1)
 *   GET /admin/review-queue     — open opportunity/duplicate review items (48.2)
 *
 * Every route is admin-only: the {@link AdminGuard} denies non-admins with 403
 * (Req 47.3 / 48 / AUTH-005) AND records an `admin_access` audit event for each
 * granted access (Req 48.3 / AUTH-006). Read-only listings accept an optional
 * `limit` and never expose full resume/email/opportunity content.
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type {
  ConnectorHealthResponse,
  AdminRunsResponse,
  ParserFailuresResponse,
  ReviewQueueResponse,
} from '@careerstack/contracts';
import { AdminGuard } from '../common/guards/admin.guard.js';
import { AdminService } from './admin.service.js';

/** Parse an optional numeric `limit` query param. */
const parseLimit = (raw?: string): number | undefined => {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('connector-health')
  async connectorHealth(): Promise<ConnectorHealthResponse> {
    return { items: await this.admin.connectorHealth() };
  }

  @Get('runs')
  async runs(@Query('limit') limit?: string): Promise<AdminRunsResponse> {
    return { runs: await this.admin.recentRuns(parseLimit(limit)) };
  }

  @Get('parser-failures')
  async parserFailures(@Query('limit') limit?: string): Promise<ParserFailuresResponse> {
    return { items: await this.admin.parserFailures(parseLimit(limit)) };
  }

  @Get('review-queue')
  async reviewQueue(@Query('limit') limit?: string): Promise<ReviewQueueResponse> {
    return { items: await this.admin.reviewQueue(parseLimit(limit)) };
  }
}
