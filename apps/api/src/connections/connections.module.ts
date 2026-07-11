/**
 * ConnectionsModule — source-connector configuration + observable runs
 * (Capability D, Req 20–25, 51; Design API §7 Sources/Runs).
 *
 * Owns the `/connectors`, `/connections`, and `/sources/manual-url` routes:
 * list connector types, create/pause/remove connections, trigger + list runs,
 * submit a manual URL, and revoke an OAuth source. Consolidates the connection
 * routes that previously lived in the PrivacyModule so there is a single owner
 * (no duplicate route registration).
 *
 * Imports {@link AuthModule} to reuse the exported guards/services (the global
 * session + CSRF guards already apply). Ownership is enforced at the repository
 * layer (`WHERE user_id = :ownerId`, PRIV-006 / Req 54). The DB handle + config
 * come from the global CoreModule; the run/manual-URL producer talks to the
 * worker over BullMQ (lazy Redis connection, mirroring the export producer).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ConnectionsController } from './connections.controller.js';
import { ConnectionsService } from './connections.service.js';
import { ConnectionRepository } from './connection.repository.js';
import { ConnectionRunRepository } from './connection-run.repository.js';
import { ConnectionsQueue } from './connections-queue.service.js';
import { ConnectionDisconnectService } from './connection-disconnect.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ConnectionsController],
  providers: [
    ConnectionsService,
    ConnectionRepository,
    ConnectionRunRepository,
    ConnectionsQueue,
    ConnectionDisconnectService,
  ],
})
export class ConnectionsModule {}
