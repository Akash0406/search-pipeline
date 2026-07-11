/**
 * PrivacyModule — data-control operations (Capability I, Req 49–54):
 * account deletion (Req 7, 50.1), async data export + owner-only signed URL
 * (Req 49), partial data deletion (Req 50.2), OAuth-source disconnect (Req 51),
 * and the raw-source retention policy surface (Req 53.1).
 *
 * Imports {@link AuthModule} to reuse the exported guards/services (the global
 * session + CSRF guards already apply). Ownership is enforced at the repository
 * layer (`WHERE user_id = :ownerId`, PRIV-006). The DB handle + config come from
 * the global CoreModule; the export producer talks to the worker over BullMQ.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { PrivacyController } from './privacy.controller.js';
import { ConnectionsController } from './connections.controller.js';
import { ExportRepository } from './export.repository.js';
import { ExportQueue } from './export-queue.service.js';
import { ExportStorage } from './export-storage.service.js';
import { ExportService } from './export.service.js';
import { DataDeletionService } from './data-deletion.service.js';
import { ConnectionRepository } from './connection.repository.js';
import { ConnectionDisconnectService } from './connection-disconnect.service.js';
import { RetentionService } from './retention.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PrivacyController, ConnectionsController],
  providers: [
    AccountDeletionService,
    ExportRepository,
    ExportQueue,
    ExportStorage,
    ExportService,
    DataDeletionService,
    ConnectionRepository,
    ConnectionDisconnectService,
    RetentionService,
  ],
})
export class PrivacyModule {}
