/**
 * Admin DTOs: connector-health, runs, review-queue, parser-failures
 * (Req 47, 48). All admin-guarded + audited server-side.
 *
 * Design API §7 (Admin routes).
 */
import { z } from 'zod';
import { healthStatusSchema, sourceTypeSchema } from './common/enums.js';
import { connectorRunSchema } from './connections.js';

/** Per-connection health row (Req 47.1). */
export const connectorHealthItemSchema = z.object({
  connectionId: z.string(),
  sourceType: sourceTypeSchema,
  displayName: z.string().optional(),
  healthStatus: healthStatusSchema,
  lastHealthReason: z.string().optional(),
  consecutiveFailures: z.number().int().nonnegative(),
  lastCheckedAt: z.string().optional(),
});
export type ConnectorHealthItem = z.infer<typeof connectorHealthItemSchema>;

export const connectorHealthResponseSchema = z.object({
  items: z.array(connectorHealthItemSchema),
});
export type ConnectorHealthResponse = z.infer<typeof connectorHealthResponseSchema>;

/** `GET /admin/runs` — recent runs across connections (Req 47.2). */
export const adminRunsResponseSchema = z.object({
  runs: z.array(connectorRunSchema),
});
export type AdminRunsResponse = z.infer<typeof adminRunsResponseSchema>;

export const reviewReasonSchema = z.enum([
  'validation_failed',
  'parse_failed',
  'uncertain_duplicate',
  'uncertain_closure',
]);
export type ReviewReason = z.infer<typeof reviewReasonSchema>;

/** A row in the admin review queue (Req 48.2). */
export const reviewQueueItemSchema = z.object({
  id: z.string(),
  reason: reviewReasonSchema,
  sourceUrl: z.string().url().optional(),
  rawArtifactId: z.string().optional(),
  opportunitySourceId: z.string().optional(),
  createdAt: z.string(),
});
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;

export const reviewQueueResponseSchema = z.object({
  items: z.array(reviewQueueItemSchema),
});
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;

/** A parser/validation failure row (Req 48.1). */
export const parserFailureItemSchema = z.object({
  id: z.string(),
  rawArtifactId: z.string(),
  sourceType: sourceTypeSchema,
  status: z.enum(['validation_failed', 'parse_failed']),
  failureReason: z.string().optional(),
  createdAt: z.string(),
});
export type ParserFailureItem = z.infer<typeof parserFailureItemSchema>;

export const parserFailuresResponseSchema = z.object({
  items: z.array(parserFailureItemSchema),
});
export type ParserFailuresResponse = z.infer<typeof parserFailuresResponseSchema>;
