/**
 * Source-connector routes (Design API §7 Sources/Runs):
 *   GET    /connectors                 — available connector types (Req 20)
 *   POST   /connections                — create a connection + initial run (20,24)
 *   GET    /connections                — list the caller's connections (24.2,54)
 *   PATCH  /connections/:id            — pause/resume or reconfigure (Req 25.1)
 *   DELETE /connections/:id?confirm    — remove (soft), keep opportunities (25.2/3)
 *   POST   /connections/:id/run        — trigger an observable run (Req 24/SRC-005)
 *   GET    /connections/:id/runs       — list the connection's runs (SRC-005)
 *   POST   /connections/:id/disconnect — revoke stored OAuth authorization (Req 51)
 *   POST   /sources/manual-url         — submit a single URL (Req 23/SRC-004)
 *
 * Every route is authenticated (global session guard); state-changing routes are
 * CSRF-protected (global CSRF guard). Ownership is enforced canonically at the
 * repository layer (`WHERE user_id = :ownerId`); foreign/missing ids surface as
 * 404 (Req 54 / PRIV-006). Request bodies are validated against the shared
 * contracts Zod schemas.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createConnectionRequestSchema,
  manualUrlSubmitRequestSchema,
  updateConnectionRequestSchema,
  type Connection,
  type ConnectionListResponse,
  type ConnectorListResponse,
  type DisconnectResponse,
  type ManualUrlSubmitResponse,
  type RunListResponse,
  type TriggerRunResponse,
} from '@careerstack/contracts';
import { CurrentUser } from '../common/decorators.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { ConnectionsService } from './connections.service.js';
import { ConnectionDisconnectService } from './connection-disconnect.service.js';

const toOptionalInt = (value?: string): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

@Controller()
export class ConnectionsController {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly disconnectService: ConnectionDisconnectService,
  ) {}

  @Get('connectors')
  listConnectors(): ConnectorListResponse {
    return this.connections.listConnectorTypes();
  }

  @Get('connections')
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ConnectionListResponse> {
    return this.connections.list(user.id);
  }

  @Post('connections')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<Connection> {
    const parsed = createConnectionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid connection.');
    }
    return this.connections.create(user.id, parsed.data);
  }

  @Patch('connections/:id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Connection> {
    const parsed = updateConnectionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid connection update.',
      );
    }
    return this.connections.update(user.id, id, parsed.data);
  }

  @Delete('connections/:id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('confirm') confirm?: string,
  ): Promise<{ status: 'removed' }> {
    // Destructive-action rule (Req 25.2): require explicit confirmation intent.
    if (confirm !== 'true') {
      throw new BadRequestException('Removing a connection requires explicit confirmation.');
    }
    return this.connections.remove(user.id, id);
  }

  @Post('connections/:id/run')
  async run(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TriggerRunResponse> {
    return this.connections.triggerRun(user.id, id);
  }

  @Get('connections/:id/runs')
  async listRuns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<RunListResponse> {
    const parsedLimit = toOptionalInt(limit);
    const parsedOffset = toOptionalInt(offset);
    return this.connections.listRuns(user.id, id, {
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
      ...(parsedOffset !== undefined ? { offset: parsedOffset } : {}),
    });
  }

  @Post('connections/:id/disconnect')
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DisconnectResponse> {
    return this.disconnectService.disconnect(user.id, id);
  }

  @Post('sources/manual-url')
  async submitManualUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<ManualUrlSubmitResponse> {
    const parsed = manualUrlSubmitRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'A valid URL is required.');
    }
    return this.connections.submitManualUrl(user.id, parsed.data.url);
  }
}
