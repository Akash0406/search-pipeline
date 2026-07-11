/**
 * Privacy DTOs: data export (request/status), delete-account, delete-data
 * (Req 7, 49, 50). Destructive operations are confirmation-gated.
 *
 * Design API §7 (Privacy routes).
 */
import { z } from 'zod';

export const exportStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);
export type ExportStatus = z.infer<typeof exportStatusSchema>;

/** `POST /privacy/export` — request an async export (Req 49). */
export const exportRequestResponseSchema = z.object({
  exportId: z.string(),
  status: exportStatusSchema,
});
export type ExportRequestResponse = z.infer<typeof exportRequestResponseSchema>;

/** `GET /privacy/export/{id}` — poll status; download available to owner only. */
export const exportStatusResponseSchema = z.object({
  id: z.string(),
  status: exportStatusSchema,
  requestedAt: z.string(),
  completedAt: z.string().optional(),
  downloadUrl: z.string().url().optional(),
});
export type ExportStatusResponse = z.infer<typeof exportStatusResponseSchema>;

/** `POST /privacy/delete-account` — explicit confirmation required (Req 7.1). */
export const deleteAccountRequestSchema = z.object({
  confirm: z.literal(true),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

export const deleteAccountResponseSchema = z.object({
  status: z.literal('deleted'),
});
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponseSchema>;

export const deleteDataCategorySchema = z.enum([
  'role_profiles',
  'saved_dismissed',
  'connections',
  'sessions',
]);
export type DeleteDataCategory = z.infer<typeof deleteDataCategorySchema>;

/** `POST /privacy/delete-data` — delete specific categories (Req 50.2). */
export const deleteDataRequestSchema = z.object({
  confirm: z.literal(true),
  categories: z.array(deleteDataCategorySchema).min(1),
});
export type DeleteDataRequest = z.infer<typeof deleteDataRequestSchema>;

export const deleteDataResponseSchema = z.object({
  status: z.literal('deleted'),
  categories: z.array(deleteDataCategorySchema),
});
export type DeleteDataResponse = z.infer<typeof deleteDataResponseSchema>;

/**
 * `GET /privacy/retention` — surface the configurable raw-source retention
 * policy (Req 53.1): the global default plus any per-user override and the
 * resulting effective window (in days).
 */
export const retentionPolicyResponseSchema = z.object({
  rawRetentionDays: z.number().int().positive(),
  userOverrideDays: z.number().int().positive().nullable(),
  effectiveDays: z.number().int().positive(),
});
export type RetentionPolicyResponse = z.infer<typeof retentionPolicyResponseSchema>;
