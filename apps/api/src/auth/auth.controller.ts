/**
 * Auth routes (Design API §7):
 *   POST /auth/oauth/google/start     — begin OAuth+PKCE (min scopes)
 *   GET  /auth/oauth/google/callback  — validate state, exchange, issue session
 *   POST /auth/magic-link             — send single-use, ≤15-min link
 *   GET  /auth/magic-link/verify      — consume link, issue session
 *   POST /auth/logout                 — revoke the current session
 *
 * Passwordless only (Req 4, 5). Every sign-in success/failure and every session
 * create/revoke is audited (Req 9). Sessions are delivered via a secure
 * HttpOnly cookie; a readable CSRF token cookie is set alongside.
 */
import { Body, Controller, Get, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '@careerstack/config';
import {
  CsrfService,
  MagicLinkService,
  OAuthStateService,
  SessionService,
  type CryptoProvider,
  type IssuedSession,
} from '@careerstack/auth';
import {
  googleOAuthStartRequestSchema,
  magicLinkRequestSchema,
  type GoogleOAuthStartResponse,
  type LogoutResponse,
  type MagicLinkRequestResponse,
} from '@careerstack/contracts';
import type { Logger } from '@careerstack/observability';
import { BadRequestException } from '@nestjs/common';
import { CONFIG, CRYPTO, LOGGER } from '../common/di-tokens.js';
import { Public } from '../common/decorators.js';
import {
  clearOAuthTxnCookie,
  clearSessionCookie,
  OAUTH_TXN_COOKIE_NAME,
  setCsrfCookie,
  setOAuthTxnCookie,
  setSessionCookie,
} from '../common/cookies.js';
import { safeReturnTo, signinErrorUrl } from '../common/redirects.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { UserService } from './user.service.js';
import { AuditService } from './audit.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CRYPTO) private readonly crypto: CryptoProvider,
    @Inject(LOGGER) private readonly logger: Logger,
    private readonly sessions: SessionService,
    private readonly magicLinks: MagicLinkService,
    private readonly oauthState: OAuthStateService,
    private readonly csrf: CsrfService,
    private readonly google: GoogleOAuthService,
    private readonly users: UserService,
    private readonly audit: AuditService,
  ) {}

  // -- Request context helpers ---------------------------------------------

  private userAgentOf(request: FastifyRequest): string | null {
    const ua = request.headers['user-agent'];
    return typeof ua === 'string' && ua.length > 0 ? ua : null;
  }

  private ipHashOf(request: FastifyRequest): string | null {
    const ip = request.ip;
    return ip ? this.crypto.hashToken(ip) : null;
  }

  /** Set both the session cookie and a fresh CSRF cookie after sign-in. */
  private establishSession(reply: FastifyReply, issued: IssuedSession): void {
    setSessionCookie(reply, this.config, issued.rawToken, issued.session.expiresAt);
    setCsrfCookie(reply, this.config, this.csrf.issueToken());
  }

  private apiOrigin(): string {
    return new URL(this.config.auth.google.redirectUri).origin;
  }

  // -- Google OAuth --------------------------------------------------------

  /** Begin the Google OAuth + PKCE flow; returns the authorization URL. */
  @Public()
  @Post('oauth/google/start')
  async googleStart(
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<GoogleOAuthStartResponse> {
    const parsed = googleOAuthStartRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException('Invalid sign-in request.');
    }
    const started = this.oauthState.start(parsed.data.returnTo);
    setOAuthTxnCookie(reply, this.config, started.sealed);
    const authorizationUrl = this.google.buildAuthUrl(started.state, started.challenge);
    return { authorizationUrl, state: started.state };
  }

  /** Handle the OAuth redirect: validate state, exchange code, issue session. */
  @Public()
  @Get('oauth/google/callback')
  async googleCallback(
    @Query() query: Record<string, string | undefined>,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const sealed = request.cookies?.[OAUTH_TXN_COOKIE_NAME];
    clearOAuthTxnCookie(reply);

    // The provider signals denial/failure via an `error` param (Req 4.3).
    if (query.error || !query.code || !query.state) {
      await this.audit.record({
        eventType: 'login_failure',
        method: 'google',
        outcome: 'failure',
        ipHash: this.ipHashOf(request),
        metadata: { reason: query.error ?? 'missing_code_or_state' },
      });
      return this.redirect(reply, signinErrorUrl('sign_in_cancelled'));
    }

    const txn = sealed ? this.oauthState.verify(sealed, query.state) : null;
    if (!txn) {
      await this.audit.record({
        eventType: 'login_failure',
        method: 'google',
        outcome: 'failure',
        ipHash: this.ipHashOf(request),
        metadata: { reason: 'invalid_state' },
      });
      return this.redirect(reply, signinErrorUrl('sign_in_failed'));
    }

    try {
      const profile = await this.google.exchangeAndVerify(query.code, txn.codeVerifier);
      const resolved = await this.users.findOrCreateByGoogle(profile);
      const issued = await this.sessions.issue(resolved.userId, {
        userAgent: this.userAgentOf(request),
        ipHash: this.ipHashOf(request),
      });
      this.establishSession(reply, issued);
      await this.audit.record({
        eventType: 'login_success',
        userId: resolved.userId,
        method: 'google',
        outcome: 'success',
        ipHash: this.ipHashOf(request),
        metadata: { firstLogin: resolved.isNewUser },
      });
      await this.audit.record({
        eventType: 'session_created',
        userId: resolved.userId,
        outcome: 'success',
        targetRef: issued.session.id,
      });
      return this.redirect(reply, safeReturnTo(txn.returnTo));
    } catch (error) {
      this.logger.warn('auth.google.callback_failed', { error });
      await this.audit.record({
        eventType: 'login_failure',
        method: 'google',
        outcome: 'failure',
        ipHash: this.ipHashOf(request),
        metadata: { reason: 'identity_verification_failed' },
      });
      return this.redirect(reply, signinErrorUrl('sign_in_failed'));
    }
  }

  // -- Magic link ----------------------------------------------------------

  /** Request a single-use, ≤15-min magic link. Always returns `sent`. */
  @Public()
  @Post('magic-link')
  async requestMagicLink(@Body() body: unknown): Promise<MagicLinkRequestResponse> {
    const parsed = magicLinkRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('A valid email address is required.');
    }
    const email = parsed.data.email;
    // Bind to an existing user when present; otherwise the user is created on
    // verify. Response is constant regardless, to avoid account enumeration.
    const userId = await this.users.findIdByEmail(email);
    const { rawToken } = await this.magicLinks.issue(email, userId);

    const link = `${this.apiOrigin()}/api/v1/auth/magic-link/verify?token=${encodeURIComponent(
      rawToken,
    )}`;
    // No email transport in this slice: the link is logged for delivery wiring.
    this.logger.info('auth.magic_link.issued', {
      event: 'auth.magic_link.issued',
      // token intentionally omitted from structured fields; link carries it.
      link,
    });
    return { status: 'sent' };
  }

  /** Consume a magic link: reject expired/used (offer resend), else sign in. */
  @Public()
  @Get('magic-link/verify')
  async verifyMagicLink(
    @Query('token') token: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.magicLinks.verify(token ?? '');
    if (!result.ok) {
      await this.audit.record({
        eventType: 'login_failure',
        method: 'magic_link',
        outcome: 'failure',
        ipHash: this.ipHashOf(request),
        metadata: { reason: result.reason },
      });
      // Expired/used links offer a resend (Req 5.3).
      const offerResend = result.reason === 'expired' || result.reason === 'used';
      return this.redirect(reply, signinErrorUrl('magic_link_invalid', offerResend));
    }

    const resolved = await this.users.findOrCreateByEmail(result.record.email);
    const issued = await this.sessions.issue(resolved.userId, {
      userAgent: this.userAgentOf(request),
      ipHash: this.ipHashOf(request),
    });
    this.establishSession(reply, issued);
    await this.audit.record({
      eventType: 'login_success',
      userId: resolved.userId,
      method: 'magic_link',
      outcome: 'success',
      ipHash: this.ipHashOf(request),
      metadata: { firstLogin: resolved.isNewUser },
    });
    await this.audit.record({
      eventType: 'session_created',
      userId: resolved.userId,
      outcome: 'success',
      targetRef: issued.session.id,
    });
    return this.redirect(reply, safeReturnTo(undefined));
  }

  // -- Logout --------------------------------------------------------------

  /** Revoke the current session and clear the cookie (idempotent). */
  @Public()
  @Post('logout')
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LogoutResponse> {
    const rawToken = request.cookies?.[this.config.auth.session.cookieName];
    if (rawToken) {
      const session = await this.sessions.authenticate(rawToken);
      const revoked = await this.sessions.revokeByToken(rawToken);
      if (session && revoked) {
        await this.audit.record({
          eventType: 'session_revoked',
          userId: session.userId,
          outcome: 'success',
          targetRef: session.id,
          metadata: { reason: 'logout' },
        });
      }
    }
    clearSessionCookie(reply, this.config);
    return { status: 'ok' };
  }

  private redirect(reply: FastifyReply, location: string): void {
    void reply.status(302).header('location', location).send();
  }
}
