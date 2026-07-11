/**
 * Data-export stage (Task 14.2, Req 49.1/49.2).
 *
 * Assembles the requesting user's own data — personal data (user + preferences),
 * role profiles (+ their child collections), saved/dismissed states, and
 * connection configuration — into a single JSON bundle, stores it privately in
 * object storage, and marks the `exports` row `ready` with its storage key. The
 * API later issues a short-lived signed URL to the OWNER ONLY (Design Security
 * §7), so nothing is delivered inline here.
 *
 * Ownership: every query is filtered by `export.userId`, so the bundle contains
 * only data owned by the requesting user and nothing owned by anyone else
 * (Req 49.1/49.2, PRIV-006).
 *
 * Idempotency (at-least-once): the producer keys the job by `exportId`, and an
 * already-`ready` export is a no-op, so retries / duplicate enqueues collapse
 * onto one bundle.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { schema } from '@careerstack/database';
import type { PipelineContext } from '../context.js';
import type { ExportJobData } from '../queues.js';

/** Shape of the assembled export bundle (owner-scoped). */
interface ExportBundle {
  exportId: string;
  userId: string;
  generatedAt: string;
  personalData: {
    user: {
      id: string;
      email: string;
      displayName: string | null;
      role: string;
      status: string;
      timezone: string | null;
      createdAt: string | null;
    } | null;
    preferences: {
      theme: string;
      timezone: string | null;
      activeRoleProfileId: string | null;
      rawRetentionDays: number | null;
    } | null;
  };
  roleProfiles: unknown[];
  savedDismissed: unknown[];
  connections: unknown[];
}

const toIso = (value: Date | null | undefined): string | null =>
  value instanceof Date ? value.toISOString() : null;

/**
 * Assemble every category of the requesting user's own data (Req 49.1). Only
 * rows owned by `userId` are read.
 */
async function assembleBundle(
  ctx: PipelineContext,
  exportId: string,
  userId: string,
): Promise<ExportBundle> {
  const { db } = ctx;

  const [userRow] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const [prefsRow] = await db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.userId, userId))
    .limit(1);

  // Role profiles + their child collections (owner-scoped via the parent).
  const profiles = await db
    .select()
    .from(schema.roleProfiles)
    .where(eq(schema.roleProfiles.userId, userId));
  const profileIds = profiles.map((p) => p.id);

  const [titles, skills, locations, preferences] =
    profileIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(schema.roleProfileTitles)
            .where(inArray(schema.roleProfileTitles.roleProfileId, profileIds)),
          db
            .select()
            .from(schema.roleProfileSkills)
            .where(inArray(schema.roleProfileSkills.roleProfileId, profileIds)),
          db
            .select()
            .from(schema.roleProfileLocations)
            .where(inArray(schema.roleProfileLocations.roleProfileId, profileIds)),
          db
            .select()
            .from(schema.roleProfilePreferences)
            .where(inArray(schema.roleProfilePreferences.roleProfileId, profileIds)),
        ])
      : [[], [], [], []];

  const byProfile = <T extends { roleProfileId: string }>(rows: T[], id: string): T[] =>
    rows.filter((r) => r.roleProfileId === id);

  const roleProfiles = profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    status: profile.status,
    salaryMin: profile.salaryMin,
    salaryMax: profile.salaryMax,
    salaryCurrency: profile.salaryCurrency,
    salaryPeriod: profile.salaryPeriod,
    workRights: profile.workRights,
    createdAt: toIso(profile.createdAt),
    updatedAt: toIso(profile.updatedAt),
    titles: byProfile(titles, profile.id).map((t) => ({ kind: t.kind, value: t.value })),
    skills: byProfile(skills, profile.id).map((s) => ({ kind: s.kind, value: s.value })),
    locations: byProfile(locations, profile.id).map((l) => ({
      value: l.value,
      isPrimary: l.isPrimary,
    })),
    preferences: byProfile(preferences, profile.id).map((pref) => ({
      workArrangements: pref.workArrangements,
      employmentTypes: pref.employmentTypes,
      seniorityLevels: pref.seniorityLevels,
    }))[0] ?? null,
  }));

  // Saved / dismissed states (Req 43), owner-scoped.
  const states = await db
    .select()
    .from(schema.opportunityUserState)
    .where(eq(schema.opportunityUserState.userId, userId));
  const savedDismissed = states.map((s) => ({
    opportunityId: s.opportunityId,
    state: s.state,
    createdAt: toIso(s.createdAt),
    updatedAt: toIso(s.updatedAt),
  }));

  // Connection configuration (Req 49.1) — config only, no ingested content.
  const connectionRows = await db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.userId, userId));
  const connections = connectionRows
    // Exclude soft-removed connections from the portable config set.
    .filter((c) => c.status !== 'removed')
    .map((c) => ({
      id: c.id,
      sourceType: c.sourceType,
      config: c.config,
      status: c.status,
      createdAt: toIso(c.createdAt),
    }));

  return {
    exportId,
    userId,
    generatedAt: new Date().toISOString(),
    personalData: {
      user: userRow
        ? {
            id: userRow.id,
            email: userRow.email,
            displayName: userRow.displayName,
            role: userRow.role,
            status: userRow.status,
            timezone: userRow.timezone,
            createdAt: toIso(userRow.createdAt),
          }
        : null,
      preferences: prefsRow
        ? {
            theme: prefsRow.theme,
            timezone: prefsRow.timezone,
            activeRoleProfileId: prefsRow.activeRoleProfileId,
            rawRetentionDays: prefsRow.rawRetentionDays,
          }
        : null,
    },
    roleProfiles,
    savedDismissed,
    connections,
  };
}

/**
 * Process one export job: assemble → store → mark ready. Throwing on failure
 * lets BullMQ retry; the `exports` row is flagged `failed` (best-effort) so the
 * user's status surface reflects the outcome (Req 56.2) until a retry succeeds.
 */
export async function runExportJob(
  ctx: PipelineContext,
  data: ExportJobData,
): Promise<{ status: 'ready' | 'skipped' }> {
  const { db, logger } = ctx;
  const { exportId, userId, correlationId } = data;

  const [existing] = await db
    .select()
    .from(schema.exports)
    .where(and(eq(schema.exports.id, exportId), eq(schema.exports.userId, userId)))
    .limit(1);

  if (!existing) {
    logger.warn('export.not_found', {
      stage: 'data-export',
      outcome: 'failure',
      correlationId,
      exportId,
    });
    return { status: 'skipped' };
  }

  // Idempotent: a completed export is never rebuilt (at-least-once safe).
  if (existing.status === 'ready' && existing.storageKey) {
    return { status: 'skipped' };
  }

  await db
    .update(schema.exports)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(schema.exports.id, exportId));

  try {
    const bundle = await assembleBundle(ctx, exportId, userId);
    const body = Buffer.from(JSON.stringify(bundle, null, 2), 'utf8');
    const stored = await ctx.storage.putExport({ userId, exportId, body });

    await db
      .update(schema.exports)
      .set({ status: 'ready', storageKey: stored.storageKey, updatedAt: new Date() })
      .where(eq(schema.exports.id, exportId));

    logger.info('export.ready', {
      stage: 'data-export',
      outcome: 'success',
      correlationId,
      exportId,
      byteSize: stored.byteSize,
    });
    return { status: 'ready' };
  } catch (err) {
    await db
      .update(schema.exports)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(schema.exports.id, exportId))
      .catch(() => undefined);
    logger.error('export.failed', {
      stage: 'data-export',
      outcome: 'failure',
      correlationId,
      exportId,
      error: err,
    });
    throw err;
  }
}
