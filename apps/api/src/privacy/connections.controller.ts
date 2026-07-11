/**
 * Connection data-control routes (Design API §7 / NestJS boundaries — the
 * PrivacyModule owns "disconnect OAuth source"):
 *   GET  /connections                — list the caller's connections (Req 51 UI)
 *   POST /connections/:id/disconnect — revoke stored OAuth authorization, stop
 *   scheduling, keep previously ingested opportunities accessible (Req 51).
 *
 * Authenticated (global session guard) + CSRF-protected (state-changing) +
 * ownership-scoped (the service/repository verify the connection is owned by the
 * caller; foreign/missing id → 404, and the list only returns owned rows).
 */
import { Controller, Get, Param, Post } from '@nestjs/common';
import type {
  Connection,
  ConnectionListResponse,
  ConnectionStatus,
  DisconnectResponse,
  HealthStatus,
} from '@careerstack/contracts';
import { CurrentUser } from '../common/decorators.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { ConnectionDisconnectService } from './connection-disconnect.service.js';
import { ConnectionRepository, type ConnectionRow } from './connection.repository.js';

const CONNECTION_STATUSES: readonly ConnectionStatus[] = ['active', 'paused', 'removed'];
const HEALTH_STATUSES: readonly HealthStatus[] = ['healthy', 'degraded', 'failing', 'unknown'];

const toConnectionStatus = (value: string): ConnectionStatus =>
  CONNECTION_STATUSES.includes(value as ConnectionStatus) ? (value as ConnectionStatus) : 'active';

const toHealthStatus = (value: string | null): HealthStatus =>
  HEALTH_STATUSES.includes(value as HealthStatus) ? (value as HealthStatus) : 'unknown';

/** Map a stored connection row onto the wire DTO (operational metadata only). */
function toConnection(row: ConnectionRow): Connection {
  return {
    id: row.id,
    sourceType: row.sourceType,
    config: (row.config ?? {}) as Record<string, unknown>,
    status: toConnectionStatus(row.status),
    healthStatus: toHealthStatus(row.healthStatus),
    ...(row.lastHealthReason ? { lastHealthReason: row.lastHealthReason } : {}),
    consecutiveFailures: row.consecutiveFailures ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
  };
}

@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly disconnectService: ConnectionDisconnectService,
    private readonly repo: ConnectionRepository,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ConnectionListResponse> {
    const rows = await this.repo.listOwned(user.id);
    return { connections: rows.map(toConnection) };
  }

  @Post(':id/disconnect')
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DisconnectResponse> {
    return this.disconnectService.disconnect(user.id, id);
  }
}
