/**
 * Role-profile DTOs: create/update/list/detail plus
 * activate/duplicate/pause/resume (Req 10–19).
 *
 * Design API §7 (Role profile routes).
 */
import { z } from 'zod';
import {
  employmentTypeSchema,
  salaryPeriodSchema,
  senioritySchema,
  workArrangementSchema,
} from './common/enums.js';

/** Target vs excluded titles (Req 11). */
export const roleProfileTitlesSchema = z.object({
  target: z.array(z.string()).default([]),
  excluded: z.array(z.string()).default([]),
});
export type RoleProfileTitles = z.infer<typeof roleProfileTitlesSchema>;

/** Required vs preferred skills (Req 12). */
export const roleProfileSkillsSchema = z.object({
  required: z.array(z.string()).default([]),
  preferred: z.array(z.string()).default([]),
});
export type RoleProfileSkills = z.infer<typeof roleProfileSkillsSchema>;

/** A preferred location (Req 13.1). */
export const roleProfileLocationSchema = z.object({
  value: z.string(),
  isPrimary: z.boolean().optional(),
});
export type RoleProfileLocation = z.infer<typeof roleProfileLocationSchema>;

/**
 * Salary preference (Req 15). Unspecified is represented by omitting the field,
 * never a zero/assumed value (Req 15.3).
 */
export const salaryPreferenceSchema = z.object({
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  period: salaryPeriodSchema.optional(),
});
export type SalaryPreference = z.infer<typeof salaryPreferenceSchema>;

/**
 * Optional, PRIVATE work-rights constraints (Req 16). Kept permissive — the
 * System never infers status from nationality/location (Req 16.4).
 */
export const workRightsSchema = z
  .object({
    note: z.string().optional(),
    requiresSponsorship: z.boolean().optional(),
    visaTypes: z.array(z.string()).optional(),
  })
  .passthrough();
export type WorkRights = z.infer<typeof workRightsSchema>;

/** Scalar preference sets (Req 13.2, 14). */
export const roleProfilePreferencesSchema = z.object({
  workArrangements: z.array(workArrangementSchema).default([]),
  employmentTypes: z.array(employmentTypeSchema).default([]),
  seniorityLevels: z.array(senioritySchema).default([]),
});
export type RoleProfilePreferences = z.infer<typeof roleProfilePreferencesSchema>;

/** `POST /role-profiles` — create. */
export const createRoleProfileRequestSchema = z.object({
  name: z.string().min(1),
  titles: roleProfileTitlesSchema.optional(),
  skills: roleProfileSkillsSchema.optional(),
  locations: z.array(roleProfileLocationSchema).optional(),
  preferences: roleProfilePreferencesSchema.optional(),
  salary: salaryPreferenceSchema.optional(),
  workRights: workRightsSchema.optional(),
});
export type CreateRoleProfileRequest = z.infer<typeof createRoleProfileRequestSchema>;

/** `PATCH /role-profiles/{id}` — partial update (Req 19.1). */
export const updateRoleProfileRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    titles: roleProfileTitlesSchema.optional(),
    skills: roleProfileSkillsSchema.optional(),
    locations: z.array(roleProfileLocationSchema).optional(),
    preferences: roleProfilePreferencesSchema.optional(),
    salary: salaryPreferenceSchema.optional(),
    workRights: workRightsSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided.',
  });
export type UpdateRoleProfileRequest = z.infer<typeof updateRoleProfileRequestSchema>;

/** Compact list item for `GET /role-profiles`. */
export const roleProfileListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'paused']),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RoleProfileListItem = z.infer<typeof roleProfileListItemSchema>;

/** Full profile for `GET /role-profiles/{id}` and mutation responses. */
export const roleProfileDetailSchema = roleProfileListItemSchema.extend({
  titles: roleProfileTitlesSchema,
  skills: roleProfileSkillsSchema,
  locations: z.array(roleProfileLocationSchema),
  preferences: roleProfilePreferencesSchema,
  salary: salaryPreferenceSchema.optional(),
  workRights: workRightsSchema.optional(),
});
export type RoleProfileDetail = z.infer<typeof roleProfileDetailSchema>;

export const roleProfileListResponseSchema = z.object({
  profiles: z.array(roleProfileListItemSchema),
});
export type RoleProfileListResponse = z.infer<typeof roleProfileListResponseSchema>;
