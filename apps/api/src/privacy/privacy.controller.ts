/**
 * Privacy routes (Design API §7, Capability I):
 *   POST /privacy/export           — request an async data export (Req 49.1/49.3)
 *   GET  /privacy/export/:id        — export status + owner-only signed URL (49.2)
 *   POST /privacy/delete-account    — confirmation-gated account deletion (Req 7)
 *   POST /privacy/delete-data       — confirmation-gated partial deletion (50.2)
 *   GET  /privacy/retention         — configurable raw-source retention (53.1)
 *
 * All routes are authenticated (global session guard); state-changing routes are
 * CSRF-protected. Destructive routes require an explicit confirmation (UX
 * destructive-action rule). Ownership is enforced per resource so nothing leaks
 * across users (PRIV-006).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '@careerstack/config';
import type { CryptoProvider } from '@careerstack/auth';
import {
  deleteAccountRequestSchema,
  deleteDataRequestSchema,
  type DeleteAccountResponse,
  type DeleteDataResponse,
  type ExportRequestResponse,
  type ExportStatusResponse,
  type RetentionPolicyResponse,
} from '@careerstack/contracts';
import { CONFIG, CRYPTO } from '../common/di-tokens.js';
import { CurrentUser } from '../common/decorators.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { clearSessionCookie } from '../common/cookies.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { ExportService } from './export.service.js';
import { DataDeletionService } from './data-deletion.service.js';
import { RetentionService } from './retention.service.js';

@Controller('privacy')
export class PrivacyController {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CRYPTO) private readonly crypto: CryptoProvider,
    private readonly deletion: AccountDeletionService,
    private readonly exports: ExportService,
    private readonly dataDeletion: DataDeletionService,
    private readonly retention: RetentionService,
  ) {}

  @Post('export')
  async requestExport(@CurrentUser() user: AuthenticatedUser): Promise<ExportRequestResponse> {
    return this.exports.request(user.id);
  }

  @Get('export/:id')
  async exportStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ExportStatusResponse> {
    return this.exports.status(user.id, id);
  }

  @Post('delete-account')
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<DeleteAccountResponse> {
    const parsed = deleteAccountRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Account deletion requires explicit confirmation.');
    }
    const ipHash = request.ip ? this.crypto.hashToken(request.ip) : null;
    await this.deletion.deleteAccount(user.id, { ipHash });
    clearSessionCookie(reply, this.config);
    return { status: 'deleted' };
  }

  @Post('delete-data')
  async deleteData(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<DeleteDataResponse> {
    const parsed = deleteDataRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        'Deleting data requires explicit confirmation and at least one category.',
      );
    }
    await this.dataDeletion.deleteCategories(user.id, parsed.data.categories);
    return { status: 'deleted', categories: parsed.data.categories };
  }

  @Get('retention')
  async retentionPolicy(@CurrentUser() user: AuthenticatedUser): Promise<RetentionPolicyResponse> {
    return this.retention.getPolicy(user.id);
  }
}
