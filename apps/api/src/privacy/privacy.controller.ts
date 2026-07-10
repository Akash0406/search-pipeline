/**
 * Privacy routes (Design API §7):
 *   POST /privacy/delete-account — confirmation-gated account deletion (Req 7).
 *
 * Requires an explicit confirmation (Req 7.1); on success it clears the session
 * cookie and the account is anonymized with all sessions invalidated. The route
 * is authenticated (global session guard) and CSRF-protected (state-changing).
 */
import { BadRequestException, Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '@careerstack/config';
import type { CryptoProvider } from '@careerstack/auth';
import {
  deleteAccountRequestSchema,
  type DeleteAccountResponse,
} from '@careerstack/contracts';
import { CONFIG, CRYPTO } from '../common/di-tokens.js';
import { CurrentUser } from '../common/decorators.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { clearSessionCookie } from '../common/cookies.js';
import { AccountDeletionService } from './account-deletion.service.js';

@Controller('privacy')
export class PrivacyController {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CRYPTO) private readonly crypto: CryptoProvider,
    private readonly deletion: AccountDeletionService,
  ) {}

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
}
