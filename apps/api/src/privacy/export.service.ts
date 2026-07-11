/**
 * Data-export orchestration (Req 49, RES-002).
 *
 * `request` creates a `pending` export row owned by the user and enqueues an
 * async assembly job to the worker (Req 49.1, 49.3). `status` returns the
 * export's current status to its owner and, once `ready`, a short-lived signed
 * download URL to the OWNER ONLY (Req 49.2, 56). Ownership is enforced by the
 * {@link ExportRepository} (foreign/missing id → 404), so neither the status
 * nor the URL can leak across users.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { generateCorrelationId } from '@careerstack/observability';
import type {
  ExportRequestResponse,
  ExportStatus,
  ExportStatusResponse,
} from '@careerstack/contracts';
import { ExportRepository, type ExportRow } from './export.repository.js';
import { ExportQueue } from './export-queue.service.js';
import { ExportStorage } from './export-storage.service.js';

const EXPORT_STATUSES: readonly ExportStatus[] = ['pending', 'processing', 'ready', 'failed'];

const toExportStatus = (value: string): ExportStatus =>
  EXPORT_STATUSES.includes(value as ExportStatus) ? (value as ExportStatus) : 'pending';

@Injectable()
export class ExportService {
  constructor(
    private readonly repo: ExportRepository,
    private readonly queue: ExportQueue,
    private readonly storage: ExportStorage,
  ) {}

  /** Create a pending export and enqueue its assembly (Req 49.1, 49.3). */
  async request(userId: string): Promise<ExportRequestResponse> {
    const row = await this.repo.createPending(userId);
    await this.queue.enqueue({
      exportId: row.id,
      userId,
      correlationId: generateCorrelationId(),
    });
    return { exportId: row.id, status: toExportStatus(row.status) };
  }

  /** Owner-scoped status; a ready export yields a short-lived signed URL. */
  async status(userId: string, exportId: string): Promise<ExportStatusResponse> {
    const row = await this.repo.findOwned(exportId, userId);
    if (!row) {
      throw new NotFoundException('Export not found.');
    }
    return this.toResponse(row);
  }

  private async toResponse(row: ExportRow): Promise<ExportStatusResponse> {
    const status = toExportStatus(row.status);
    const base: ExportStatusResponse = {
      id: row.id,
      status,
      requestedAt: row.createdAt.toISOString(),
    };
    if (status === 'ready' && row.storageKey) {
      base.completedAt = row.updatedAt?.toISOString();
      base.downloadUrl = await this.storage.signedDownloadUrl(row.storageKey);
    }
    return base;
  }
}
