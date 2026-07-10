/**
 * Connector / connection DTOs: list connector types, create/update/pause/remove
 * connections, manual-URL submit, run, disconnect, and observable runs
 * (Req 20–27, 51).
 *
 * Design API §7 (Sources, Runs routes).
 */
import { z } from 'zod';
import { healthStatusSchema, sourceTypeSchema } from './common/enums.js';

/** Available connector type from `GET /connectors`. */
export const connectorListItemSchema = z.object({
  id: z.string(),
  sourceType: sourceTypeSchema,
  displayName: z.string(),
  isFirstParty: z.boolean(),
});
export type ConnectorListItem = z.infer<typeof connectorListItemSchema>;

export const connectorListResponseSchema = z.object({
  connectors: z.array(connectorListItemSchema),
});
export type ConnectorListResponse = z.infer<typeof connectorListResponseSchema>;

export const connectionStatusSchema = z.enum(['active', 'paused', 'removed']);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const connectorRunStatusSchema = z.enum(['running', 'succeeded', 'failed']);
export type ConnectorRunStatus = z.infer<typeof connectorRunStatusSchema>;

/** An observable connector run (Req 24). */
export const connectorRunSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  status: connectorRunStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  itemsDiscovered: z.number().int().nonnegative(),
  itemsFetched: z.number().int().nonnegative(),
  itemsParsed: z.number().int().nonnegative(),
  itemsPersisted: z.number().int().nonnegative(),
  itemsFailed: z.number().int().nonnegative(),
  failureReason: z.string().optional(),
});
export type ConnectorRun = z.infer<typeof connectorRunSchema>;

/** A configured connection (Req 20, 24, 25). */
export const connectionSchema = z.object({
  id: z.string(),
  sourceType: sourceTypeSchema,
  displayName: z.string().optional(),
  config: z.record(z.unknown()),
  status: connectionStatusSchema,
  healthStatus: healthStatusSchema,
  lastHealthReason: z.string().optional(),
  consecutiveFailures: z.number().int().nonnegative(),
  lastRun: connectorRunSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Connection = z.infer<typeof connectionSchema>;

export const connectionListResponseSchema = z.object({
  connections: z.array(connectionSchema),
});
export type ConnectionListResponse = z.infer<typeof connectionListResponseSchema>;

/** `POST /connections` — create a connection bound to a connector + config. */
export const createConnectionRequestSchema = z.object({
  sourceType: sourceTypeSchema,
  config: z.record(z.unknown()),
});
export type CreateConnectionRequest = z.infer<typeof createConnectionRequestSchema>;

/** `PATCH /connections/{id}` — pause/resume or reconfigure (Req 25.1). */
export const updateConnectionRequestSchema = z
  .object({
    status: z.enum(['active', 'paused']).optional(),
    config: z.record(z.unknown()).optional(),
  })
  .refine((v) => v.status !== undefined || v.config !== undefined, {
    message: 'At least one field must be provided.',
  });
export type UpdateConnectionRequest = z.infer<typeof updateConnectionRequestSchema>;

/** `POST /sources/manual-url` — submit a single URL (Req 23). */
export const manualUrlSubmitRequestSchema = z.object({
  url: z.string().url(),
});
export type ManualUrlSubmitRequest = z.infer<typeof manualUrlSubmitRequestSchema>;

export const manualUrlSubmitResponseSchema = z.object({
  runId: z.string(),
  status: connectorRunStatusSchema,
});
export type ManualUrlSubmitResponse = z.infer<typeof manualUrlSubmitResponseSchema>;

/** `POST /connections/{id}/run` — enqueue a run (Req 24). */
export const triggerRunResponseSchema = z.object({
  runId: z.string(),
  status: connectorRunStatusSchema,
});
export type TriggerRunResponse = z.infer<typeof triggerRunResponseSchema>;

/** `POST /connections/{id}/disconnect` — revoke OAuth authorization (Req 51). */
export const disconnectResponseSchema = z.object({
  status: z.literal('disconnected'),
});
export type DisconnectResponse = z.infer<typeof disconnectResponseSchema>;

export const runListResponseSchema = z.object({
  runs: z.array(connectorRunSchema),
});
export type RunListResponse = z.infer<typeof runListResponseSchema>;
