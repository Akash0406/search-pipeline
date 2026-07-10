/**
 * Shared enum vocabularies used across every DTO in this slice.
 *
 * These are the single source of truth for value sets that also appear in the
 * database (`source_type`, `extraction_method`, `opportunity_status`) and in
 * the pure domain layer. Values are kept identical to the design's canonical
 * conventions:
 *  - `SourceType`      → lowercase (matches the Postgres `source_type` enum).
 *  - `ExtractionMethod`→ uppercase (glossary/OPP-003).
 *  - Canonical status  → the stored subset; display status adds per-user overlays.
 */
import { z } from 'zod';

/** Pluggable source kinds. `gmail` is reserved for a future spec (never built here). */
export const sourceTypeSchema = z.enum([
  'greenhouse',
  'lever',
  'ashby',
  'jsonld',
  'manual_url',
  'gmail',
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

/** How a fact was extracted (provenance / evidence). */
export const extractionMethodSchema = z.enum([
  'STRUCTURED_DATA',
  'RULE',
  'PARSER',
  'LLM',
  'USER',
]);
export type ExtractionMethod = z.infer<typeof extractionMethodSchema>;

/** Where/how a role is worked. */
export const workArrangementSchema = z.enum(['on_site', 'hybrid', 'remote']);
export type WorkArrangement = z.infer<typeof workArrangementSchema>;

/** Employment relationship. */
export const employmentTypeSchema = z.enum([
  'full_time',
  'part_time',
  'contract',
  'internship',
  'temporary',
]);
export type EmploymentType = z.infer<typeof employmentTypeSchema>;

/** Role level. */
export const senioritySchema = z.enum([
  'intern',
  'junior',
  'mid',
  'senior',
  'lead',
  'principal',
  'executive',
]);
export type Seniority = z.infer<typeof senioritySchema>;

/** Pay period for a salary range. */
export const salaryPeriodSchema = z.enum(['hour', 'day', 'month', 'year']);
export type SalaryPeriod = z.infer<typeof salaryPeriodSchema>;

/** Canonical stored status (subset). Saved/Applied/Dismissed are display overlays. */
export const canonicalStatusSchema = z.enum([
  'New',
  'Active',
  'Closing soon',
  'Closed',
  'Expired',
  'Removed',
  'Needs review',
  'Duplicate',
]);
export type CanonicalStatus = z.infer<typeof canonicalStatusSchema>;

/**
 * Full display vocabulary (Req 46.1). Adds the per-user overlays. `Applied` is
 * reserved/out-of-scope this slice but included so the label set is complete.
 */
export const displayStatusSchema = z.enum([
  'New',
  'Active',
  'Closing soon',
  'Closed',
  'Expired',
  'Removed',
  'Needs review',
  'Duplicate',
  'Saved',
  'Applied',
  'Dismissed',
]);
export type DisplayStatus = z.infer<typeof displayStatusSchema>;

/** Per-user overlay state for an opportunity (save/dismiss, Req 43). */
export const userStateSchema = z.enum(['none', 'saved', 'dismissed']);
export type UserState = z.infer<typeof userStateSchema>;

/** Health of a connection/connector (Req 24, 47). */
export const healthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'failing',
  'unknown',
]);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

/** Theme preference (Req 3.5). */
export const themeSchema = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof themeSchema>;
