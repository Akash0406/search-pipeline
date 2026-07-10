/**
 * Auth DTOs: Google OAuth (start/callback), magic link (request/verify), logout.
 * Passwordless only — no password fields exist anywhere (Req 4.5, 5.5, 28.1).
 *
 * Design API §7 (Auth routes).
 */
import { z } from 'zod';

/** `POST /auth/oauth/google/start` — begin the OAuth+PKCE flow. */
export const googleOAuthStartRequestSchema = z.object({
  returnTo: z.string().optional(),
});
export type GoogleOAuthStartRequest = z.infer<typeof googleOAuthStartRequestSchema>;

export const googleOAuthStartResponseSchema = z.object({
  authorizationUrl: z.string().url(),
  state: z.string(),
});
export type GoogleOAuthStartResponse = z.infer<typeof googleOAuthStartResponseSchema>;

/** `GET /auth/oauth/google/callback` — validate state, exchange code. */
export const googleOAuthCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type GoogleOAuthCallbackQuery = z.infer<typeof googleOAuthCallbackQuerySchema>;

/** `POST /auth/magic-link` — request a single-use, ≤15-min link (Req 5). */
export const magicLinkRequestSchema = z.object({
  email: z.string().email(),
  returnTo: z.string().optional(),
});
export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;

export const magicLinkRequestResponseSchema = z.object({
  status: z.literal('sent'),
});
export type MagicLinkRequestResponse = z.infer<typeof magicLinkRequestResponseSchema>;

/** `GET /auth/magic-link/verify` — consume the token (Req 5.2, 5.3). */
export const magicLinkVerifyQuerySchema = z.object({
  token: z.string().min(1),
});
export type MagicLinkVerifyQuery = z.infer<typeof magicLinkVerifyQuerySchema>;

/** Shape returned once a session has been established. */
export const authSessionResultSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  expiresAt: z.string(),
});
export type AuthSessionResult = z.infer<typeof authSessionResultSchema>;

/** `POST /auth/logout` — revoke the current session. */
export const logoutResponseSchema = z.object({
  status: z.literal('ok'),
});
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
