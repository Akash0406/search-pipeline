/**
 * Disconnect an OAuth-connected source (Req 51, PRIV-003).
 *
 * On disconnect the service, in a single transaction:
 *  1. DISCARDS the stored OAuth authorization for the connection's linked
 *     account — access/refresh tokens and granted scopes are cleared and the
 *     account is marked disconnected (Req 51.1), and
 *  2. STOPS scheduling by moving the connection to `paused` (the scheduler only
 *     enqueues `active` connections) and detaching the OAuth link (Req 51.2).
 *
 * Previously ingested opportunities are NEVER touched and remain accessible
 * (Req 51.3). Ownership is verified up front (foreign/missing id → 404).
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import { accounts, connections } from '@careerstack/database';
import type { DisconnectResponse } from '@careerstack/contracts';
import { DB } from '../common/di-tokens.js';
import { ConnectionRepository } from './connection.repository.js';

@Injectable()
export class ConnectionDisconnectService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly repo: ConnectionRepository,
  ) {}

  async disconnect(userId: string, connectionId: string): Promise<DisconnectResponse> {
    const connection = await this.repo.findOwned(connectionId, userId);
    if (!connection) {
      throw new NotFoundException('Connection not found.');
    }

    await this.db.transaction(async (tx) => {
      // 1. Revoke/discard stored authorization on the linked account (Req 51.1).
      if (connection.oauthAccountId) {
        await tx
          .update(accounts)
          .set({
            accessTokenEnc: null,
            refreshTokenEnc: null,
            scopes: null,
            connectedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, connection.oauthAccountId));
      }

      // 2. Stop scheduling + detach the OAuth link (Req 51.2). Opportunities are
      //    left intact (Req 51.3).
      await tx
        .update(connections)
        .set({ status: 'paused', oauthAccountId: null, updatedAt: new Date() })
        .where(eq(connections.id, connectionId));
    });

    return { status: 'disconnected' };
  }
}
