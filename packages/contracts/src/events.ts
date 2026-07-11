/**
 * Live event DTOs for the Server-Sent Events stream (`GET /events`, Design API
 * §7 "Live"). These are the typed events pushed to the initiating user so the
 * UI can reflect long-running work without polling (Req 56.1, 56.2):
 *   - `run.status`         — a connector run started/finished (health + counts)
 *   - `opportunity.changed`— ingested opportunities changed (explorer refresh)
 *   - `export.status`      — an async data export changed state
 *
 * Events are always per-user scoped server-side (never fan out across users).
 * The envelope is intentionally small — the client uses it as an invalidation
 * signal and re-fetches the authoritative resource.
 */
import { z } from 'zod';
import { healthStatusSchema } from './common/enums.js';
import { connectorRunStatusSchema } from './connections.js';
import { exportStatusSchema } from './privacy.js';

/** A connector run changed state (Req 47.2, 56). */
export const runStatusEventSchema = z.object({
  type: z.literal('run.status'),
  connectionId: z.string(),
  runId: z.string(),
  status: connectorRunStatusSchema,
  healthStatus: healthStatusSchema.optional(),
});
export type RunStatusEvent = z.infer<typeof runStatusEventSchema>;

/** Ingested opportunities changed; the explorer/dashboard should refresh (Req 56). */
export const opportunityChangedEventSchema = z.object({
  type: z.literal('opportunity.changed'),
  opportunityId: z.string().optional(),
});
export type OpportunityChangedEvent = z.infer<typeof opportunityChangedEventSchema>;

/** An async export changed state (Req 49.3, 56). */
export const exportStatusEventSchema = z.object({
  type: z.literal('export.status'),
  exportId: z.string(),
  status: exportStatusSchema,
});
export type ExportStatusEvent = z.infer<typeof exportStatusEventSchema>;

/** The discriminated union of all live events streamed over `GET /events`. */
export const liveEventSchema = z.discriminatedUnion('type', [
  runStatusEventSchema,
  opportunityChangedEventSchema,
  exportStatusEventSchema,
]);
export type LiveEvent = z.infer<typeof liveEventSchema>;

/** The set of event `type` discriminants (handy for client switch exhaustiveness). */
export type LiveEventType = LiveEvent['type'];
