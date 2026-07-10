/**
 * Google OAuth Authorization Code + PKCE (AUTH-001, Req 4, 52).
 *
 * Requests the MINIMUM scopes only — `openid email profile` (Req 52.1/52.2,
 * PRIV-004) — and never touches the user's Google password (Req 4.5). Token
 * exchange sends the PKCE `code_verifier`; the returned `id_token` is verified
 * (signature + audience) before the identity is trusted.
 */
import { Inject, Injectable } from '@nestjs/common';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import type { Config } from '@careerstack/config';
import type { PkceChallenge } from '@careerstack/auth';
import { CONFIG } from '../common/di-tokens.js';
import type { GoogleProfile } from './user.service.js';

/** The only scopes this platform requests for authentication (Req 52). */
export const GOOGLE_MIN_SCOPES = ['openid', 'email', 'profile'] as const;

export class GoogleIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleIdentityError';
  }
}

@Injectable()
export class GoogleOAuthService {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(@Inject(CONFIG) config: Config) {
    this.clientId = config.auth.google.clientId;
    this.client = new OAuth2Client({
      clientId: config.auth.google.clientId,
      clientSecret: config.auth.google.clientSecret,
      redirectUri: config.auth.google.redirectUri,
    });
  }

  /** Build the provider authorization URL with state + PKCE and min scopes. */
  buildAuthUrl(state: string, challenge: PkceChallenge): string {
    return this.client.generateAuthUrl({
      scope: [...GOOGLE_MIN_SCOPES],
      state,
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: challenge.codeChallenge,
      access_type: 'online',
      include_granted_scopes: false,
      prompt: 'select_account',
    });
  }

  /** Exchange the auth code (with PKCE verifier) and verify the id token. */
  async exchangeAndVerify(code: string, codeVerifier: string): Promise<GoogleProfile> {
    let idToken: string | null | undefined;
    try {
      const { tokens } = await this.client.getToken({ code, codeVerifier });
      idToken = tokens.id_token;
    } catch (error) {
      throw new GoogleIdentityError(
        `Token exchange failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    if (!idToken) {
      throw new GoogleIdentityError('Authorization response did not include an id token.');
    }

    const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new GoogleIdentityError('Verified identity is missing a subject or email.');
    }

    return {
      providerAccountId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      displayName: payload.name ?? null,
      scopes: [...GOOGLE_MIN_SCOPES],
    };
  }
}
