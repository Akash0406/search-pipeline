/**
 * Opportunity DTOs: list (no description), detail (+sources+evidence), and
 * per-user save/dismiss (Req 40, 43, 45, 58.3).
 *
 * The list/detail shapes live in `common/opportunity.ts` (shared). This file
 * adds the request/response wrappers and the explorer list response, which is
 * paginated and item-projected (never includes `description`, Property 21).
 *
 * Design API §7 (Opportunities routes).
 */
import { z } from 'zod';
import { paginated } from './common/envelopes.js';
import { userStateSchema } from './common/enums.js';
import {
  opportunityDetailSchema,
  opportunityListItemSchema,
} from './common/opportunity.js';

/** `GET /opportunities` — cursor-paginated, description-free list. */
export const opportunityListResponseSchema = paginated(opportunityListItemSchema);
export type OpportunityListResponse = z.infer<typeof opportunityListResponseSchema>;

/** `GET /opportunities/{id}` — full detail. */
export const opportunityDetailResponseSchema = opportunityDetailSchema;
export type OpportunityDetailResponse = z.infer<typeof opportunityDetailResponseSchema>;

/**
 * Response for `PUT/DELETE /opportunities/{id}/save` and `/dismiss`.
 * Reversal clears state back to `none` (Req 43.3).
 */
export const opportunityUserStateResponseSchema = z.object({
  opportunityId: z.string(),
  state: userStateSchema,
});
export type OpportunityUserStateResponse = z.infer<
  typeof opportunityUserStateResponseSchema
>;
