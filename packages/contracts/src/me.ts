/**
 * `me` DTOs: current user, preferences (theme/timezone), and session
 * list/revoke (Req 3.5, 6).
 *
 * Design API §7 (Me, Sessions routes).
 */
import { z } from 'zod';
import { themeSchema } from './common/enums.js';

/** `GET /me` — the authenticated user. */
export const meResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().optional(),
  role: z.enum(['user', 'admin']),
  theme: themeSchema,
  timezone: z.string().optional(),
  activeRoleProfileId: z.string().nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** `PATCH /me/preferences` — update theme/timezone (A3.5). */
export const updatePreferencesRequestSchema = z
  .object({
    theme: themeSchema.optional(),
    timezone: z.string().optional(),
  })
  .refine((v) => v.theme !== undefined || v.timezone !== undefined, {
    message: 'At least one preference must be provided.',
  });
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>;

export const preferencesResponseSchema = z.object({
  theme: themeSchema,
  timezone: z.string().optional(),
});
export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>;

/** A session as shown in `GET /me/sessions` (Req 6.1). */
export const sessionListItemSchema = z.object({
  id: z.string(),
  userAgent: z.string().optional(),
  approxLocation: z.string().optional(),
  lastActiveAt: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  current: z.boolean(),
});
export type SessionListItem = z.infer<typeof sessionListItemSchema>;

export const sessionListResponseSchema = z.object({
  sessions: z.array(sessionListItemSchema),
});
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;

/** `DELETE /me/sessions?others=true` — revoke individual or all-other sessions. */
export const revokeSessionsQuerySchema = z.object({
  others: z.coerce.boolean().optional(),
});
export type RevokeSessionsQuery = z.infer<typeof revokeSessionsQuerySchema>;

export const revokeSessionResponseSchema = z.object({
  revoked: z.number().int().nonnegative(),
});
export type RevokeSessionResponse = z.infer<typeof revokeSessionResponseSchema>;
