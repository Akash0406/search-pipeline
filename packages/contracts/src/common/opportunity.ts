/**
 * Canonical Opportunity wire shapes shared between the list and detail DTOs.
 *
 * IMPORTANT (Req 33.3, 45.5): reserved match/analysis fields (`matchScore`,
 * `analysis`, embeddings) are intentionally ABSENT from every wire schema in
 * this slice. They are out of scope and must not appear on the DTOs.
 */
import { z } from 'zod';
import {
  canonicalStatusSchema,
  employmentTypeSchema,
  extractionMethodSchema,
  salaryPeriodSchema,
  senioritySchema,
  sourceTypeSchema,
  workArrangementSchema,
} from './enums.js';

/** A salary range; only present when the source actually provided it (OPP-003.3). */
export const salaryRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  currency: z.string().optional(),
  period: salaryPeriodSchema.optional(),
});
export type SalaryRange = z.infer<typeof salaryRangeSchema>;

/** Provenance attached to one populated canonical fact (OPP-003). */
export const evidenceSchema = z.object({
  field: z.string(),
  rawArtifactId: z.string(),
  sourceText: z.string(),
  method: extractionMethodSchema,
  confidence: z.number().min(0).max(1),
  uncertain: z.boolean(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

/** A contributing source retained after dedup/merge (OPP-006). */
export const opportunitySourceRefSchema = z.object({
  id: z.string(),
  sourceType: sourceTypeSchema,
  externalId: z.string(),
  sourceUrl: z.string().url(),
  applyUrl: z.string().url().optional(),
  isFirstParty: z.boolean(),
  rawArtifactId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type OpportunitySourceRef = z.infer<typeof opportunitySourceRefSchema>;

/**
 * Explorer LIST item (Req 40.3 / 58.3 / Property 21).
 *
 * Deliberately EXCLUDES `description` (and the heavy `sources`/`evidence`
 * collections) so list responses stay lightweight.
 */
export const opportunityListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  canonicalUrl: z.string().url(),
  applyUrl: z.string().url().optional(),
  locations: z.array(z.string()),
  workArrangement: workArrangementSchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  seniority: senioritySchema.optional(),
  salary: salaryRangeSchema.optional(),
  status: canonicalStatusSchema,
  postedAt: z.string().optional(),
  firstSeenAt: z.string(),
  lastUpdatedAt: z.string(),
  closingAt: z.string().optional(),
  isFirstParty: z.boolean(),
  duplicateGroupId: z.string().optional(),
});
export type OpportunityListItem = z.infer<typeof opportunityListItemSchema>;

/**
 * Opportunity DETAIL (Req 45). INCLUDES `description`, contributing `sources`,
 * and per-fact `evidence`.
 */
export const opportunityDetailSchema = opportunityListItemSchema.extend({
  description: z.string().optional(),
  sources: z.array(opportunitySourceRefSchema).min(1),
  evidence: z.array(evidenceSchema),
});
export type OpportunityDetail = z.infer<typeof opportunityDetailSchema>;
