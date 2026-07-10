/**
 * Cross-cutting response envelopes shared by every API resource.
 *
 * - {@link errorEnvelopeSchema} is the single standard error shape.
 * - {@link paginated} builds the cursor-pagination envelope for a list item.
 *
 * Design API §7 fixes these shapes as the contract source of truth.
 */
import { z } from 'zod';

/** Machine-readable error codes returned in the standard envelope. */
export const errorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_ERROR',
  'RATE_LIMITED',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** One entry describing a specific problem (e.g., a field validation issue). */
export const errorDetailSchema = z.object({
  path: z.string().optional(),
  message: z.string(),
});
export type ErrorDetail = z.infer<typeof errorDetailSchema>;

/**
 * Standard error envelope:
 * `{ error: { code, message, requestId, details } }`
 */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    details: z.array(errorDetailSchema).default([]),
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

/** Cursor pagination metadata. */
export const pageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type PageInfo = z.infer<typeof pageInfoSchema>;

/**
 * Wrap an item schema in the cursor-pagination envelope:
 * `{ data: [...], page: { nextCursor, hasMore } }`
 */
export function paginated<ItemSchema extends z.ZodTypeAny>(item: ItemSchema) {
  return z.object({
    data: z.array(item),
    page: pageInfoSchema,
  });
}

/** Common cursor pagination query parameters for list endpoints. */
export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
