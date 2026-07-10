/**
 * Append-only auth/admin audit writer (AUTH-006, Req 9).
 *
 * Writes sign-in success/failure, session created/revoked, account deletion,
 * and admin-access events to `audit_logs`. The table is INSERT/SELECT-only for
 * the app role (UPDATE/DELETE revoked in the migration), so events are not
 * editable through standard actions (Req 9.4). Writes are best-effort: a
 * logging failure is recorded but never breaks the primary auth flow.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@careerstack/database';
import { auditLogs } from '@careerstack/database';
import type { Logger } from '@careerstack/observability';
import { DB, LOGGER } from '../common/di-tokens.js';

export type AuditEventType =
  | 'login_success'
  | 'login_failure'
  | 'session_created'
  | 'session_revoked'
  | 'account_deleted'
  | 'admin_access';

export interface AuditEvent {
  eventType: AuditEventType;
  userId?: string | null;
  actor?: 'user' | 'admin' | 'system';
  method?: 'google' | 'magic_link' | null;
  outcome?: 'success' | 'failure';
  targetRef?: string | null;
  metadata?: Record<string, unknown> | null;
  ipHash?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        userId: event.userId ?? null,
        actor: event.actor ?? 'user',
        eventType: event.eventType,
        method: event.method ?? null,
        outcome: event.outcome ?? null,
        targetRef: event.targetRef ?? null,
        metadata: event.metadata ?? null,
        ipHash: event.ipHash ?? null,
      });
    } catch (error) {
      // Never let an audit-write failure break the primary flow; surface it.
      this.logger.error('audit.write.failed', { error, event: event.eventType });
    }
  }

  /** Record an audit event within an existing transaction (deletion flow). */
  async recordTx(tx: Database, event: AuditEvent): Promise<void> {
    await tx.insert(auditLogs).values({
      userId: event.userId ?? null,
      actor: event.actor ?? 'user',
      eventType: event.eventType,
      method: event.method ?? null,
      outcome: event.outcome ?? null,
      targetRef: event.targetRef ?? null,
      metadata: event.metadata ?? null,
      ipHash: event.ipHash ?? null,
    });
  }
}
