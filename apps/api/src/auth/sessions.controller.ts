/**
 * Session management routes (AUTH-003, Req 6):
 *   GET    /me/sessions                 — list active sessions
 *   DELETE /me/sessions/:id             — revoke a specific session
 *   DELETE /me/sessions?others=true     — revoke all but the current session
 *
 * Timestamps are returned as ISO-8601 strings so the client can render them in
 * the user's timezone with the exact value on demand (Req 6.4). Revocations are
 * owner-scoped (the store filters by user id) and audited (Req 9.2).
 */
import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { SessionService, type StoredSession } from '@careerstack/auth';
import {
  revokeSessionsQuerySchema,
  type RevokeSessionResponse,
  type SessionListItem,
  type SessionListResponse,
} from '@careerstack/contracts';
import { CurrentSessionId, CurrentUser } from '../common/decorators.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { AuditService } from './audit.service.js';

@Controller('me/sessions')
export class SessionsController {
  constructor(
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  private toItem(session: StoredSession, currentId: string): SessionListItem {
    return {
      id: session.id,
      ...(session.userAgent ? { userAgent: session.userAgent } : {}),
      ...(session.approxLocation ? { approxLocation: session.approxLocation } : {}),
      lastActiveAt: session.lastActiveAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === currentId,
    };
  }

  /** List the user's active sessions with device/location/last-active info. */
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId: string,
  ): Promise<SessionListResponse> {
    const active = await this.sessions.listActive(user.id);
    return { sessions: active.map((s) => this.toItem(s, currentSessionId)) };
  }

  /** Revoke one session owned by the user (Req 6.2). */
  @Delete(':id')
  async revokeOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RevokeSessionResponse> {
    const revoked = await this.sessions.revokeById(id, user.id);
    if (revoked) {
      await this.audit.record({
        eventType: 'session_revoked',
        userId: user.id,
        outcome: 'success',
        targetRef: id,
      });
    }
    return { revoked: revoked ? 1 : 0 };
  }

  /**
   * Revoke sessions in bulk. `?others=true` keeps the current session and
   * revokes the rest (Req 6.3); otherwise every session is revoked.
   */
  @Delete()
  async revokeBulk(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() currentSessionId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<RevokeSessionResponse> {
    const parsed = revokeSessionsQuerySchema.safeParse(query);
    const others = parsed.success ? parsed.data.others === true : false;
    const revoked = others
      ? await this.sessions.revokeOthers(user.id, currentSessionId)
      : await this.sessions.revokeAll(user.id);
    if (revoked > 0) {
      await this.audit.record({
        eventType: 'session_revoked',
        userId: user.id,
        outcome: 'success',
        targetRef: others ? 'others' : 'all',
        metadata: { count: revoked },
      });
    }
    return { revoked };
  }
}
