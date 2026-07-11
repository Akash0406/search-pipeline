/**
 * Connection data-control route (Design API §7 / NestJS boundaries — the
 * PrivacyModule owns "disconnect OAuth source"):
 *   POST /connections/:id/disconnect — revoke stored OAuth authorization, stop
 *   scheduling, keep previously ingested opportunities accessible (Req 51).
 *
 * Authenticated (global session guard) + CSRF-protected (state-changing) +
 * ownership-scoped (the service verifies the connection is owned by the caller;
 * foreign/missing id → 404).
 */
import { Controller, Param, Post } from '@nestjs/common';
import type { DisconnectResponse } from '@careerstack/contracts';
import { CurrentUser } from '../common/decorators.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { ConnectionDisconnectService } from './connection-disconnect.service.js';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly disconnectService: ConnectionDisconnectService) {}

  @Post(':id/disconnect')
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DisconnectResponse> {
    return this.disconnectService.disconnect(user.id, id);
  }
}
