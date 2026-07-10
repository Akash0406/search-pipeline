/**
 * Deduplication + transactional persist stage (Task 10.6, Req 36/37).
 *
 * Reconstructs the candidate neighborhood from `opportunity_sources` (exact
 * identity keys + fingerprint + canonical URL), runs the pure `deduplicate()`
 * cascade over the new candidate plus its neighbors, then persists the resolved
 * canonical opportunity in ONE database transaction together with:
 *   - the retained `opportunity_sources` row (ALL sources kept — Req 37.1/37.3);
 *   - child rows: locations / skills / requirements / sanitized content / evidence;
 *   - `duplicate_groups` linkage when the group has >1 member;
 *   - a `content_revisions` row when canonical fields changed (Req 39);
 *   - an `outbox_events` row written IN THE SAME TRANSACTION (Req 36/37).
 *
 * First-party-wins: canonical field values come from the group's canonical
 * member (first-party preferred), computed by the pure engine (Req 36.4). Low
 * confidence fuzzy pairs are routed to review, never auto-merged (Req 36.3).
 */

import { and, eq, inArray, or } from 'drizzle-orm';
import { sanitizeHtml } from '@careerstack/security';
import {
  deduplicate,
  normalizeCompany,
  normalizeTitle,
  type CanonicalCandidate,
  type DedupCandidate,
} from '@careerstack/shared';
import { schema, type Database } from '@careerstack/database';
import {
  canonicalContentHash,
  diffCanonicalFields,
  snapshotFromCandidate,
} from '../content-change.js';
import type { PipelineContext } from '../context.js';
import type { DeduplicationJobData } from '../queues.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type OpportunityRow = typeof schema.opportunities.$inferSelect;

const EXISTING_PREFIX = 'existing:';

/** Strip HTML tags for the plain-text description projection. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** numeric → string|null for Drizzle numeric columns. */
function num(value: number | undefined): string | null {
  return value === undefined ? null : value.toString();
}

/** Canonical column values written on insert/update (excludes firstSeenAt). */
function canonicalColumns(candidate: CanonicalCandidate, contentHash: string, now: Date) {
  return {
    title: candidate.title,
    company: candidate.company,
    canonicalUrl: candidate.canonicalUrl,
    applyUrl: candidate.applyUrl ?? null,
    workArrangement: candidate.workArrangement ?? null,
    employmentType: candidate.employmentType ?? null,
    seniority: candidate.seniority ?? null,
    salaryMin: num(candidate.salary?.min),
    salaryMax: num(candidate.salary?.max),
    salaryCurrency: candidate.salary?.currency ?? null,
    salaryPeriod: candidate.salary?.period ?? null,
    postedAt: candidate.postedAt ? new Date(candidate.postedAt) : null,
    closingAt: candidate.closingAt ? new Date(candidate.closingAt) : null,
    lastUpdatedAt: now,
    fingerprint: candidate.fingerprint,
    contentHash,
    isFirstParty: candidate.isFirstParty,
  };
}

/** Rebuild a {@link DedupCandidate} for a stored source + its opportunity. */
function existingCandidate(
  source: typeof schema.opportunitySources.$inferSelect,
  opp: OpportunityRow,
): DedupCandidate {
  const candidate: DedupCandidate = {
    key: `${EXISTING_PREFIX}${source.id}`,
    sourceType: source.sourceType,
    externalId: source.externalId ?? '',
    canonicalUrl: opp.canonicalUrl ?? '',
    fingerprint: source.fingerprint ?? opp.fingerprint ?? '',
    isFirstParty: source.isFirstParty,
    normalizedTitle: normalizeTitle(opp.title),
    normalizedCompany: normalizeCompany(opp.company),
    locationKey: '',
    evidenceConfidence: source.confidence !== null ? Number(source.confidence) : 0,
    updatedAt: opp.lastUpdatedAt.toISOString(),
  };
  if (source.applyUrl) candidate.applyUrl = source.applyUrl;
  if (source.atsBoard) candidate.atsBoard = source.atsBoard;
  if (source.atsPostingId) candidate.atsPostingId = source.atsPostingId;
  return candidate;
}

/** Gather stored sources whose identity/fingerprint/URL neighbors the candidate. */
async function gatherNeighborhood(
  tx: Tx,
  candidate: CanonicalCandidate,
): Promise<{ sources: (typeof schema.opportunitySources.$inferSelect)[]; opps: Map<string, OpportunityRow> }> {
  const os = schema.opportunitySources;
  const identityClauses = [
    and(eq(os.sourceType, candidate.sourceType), eq(os.externalId, candidate.externalId)),
    eq(os.fingerprint, candidate.fingerprint),
  ];
  if (candidate.applyUrl) identityClauses.push(eq(os.applyUrl, candidate.applyUrl));

  const bySource = await tx.select().from(os).where(or(...identityClauses));

  const byUrl = await tx
    .select({ id: schema.opportunities.id })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.canonicalUrl, candidate.canonicalUrl));

  const oppIds = new Set<string>();
  for (const s of bySource) oppIds.add(s.opportunityId);
  for (const o of byUrl) oppIds.add(o.id);

  if (oppIds.size === 0) return { sources: [], opps: new Map() };

  const ids = [...oppIds];
  const allSources = await tx.select().from(os).where(inArray(os.opportunityId, ids));
  const oppRows = await tx
    .select()
    .from(schema.opportunities)
    .where(inArray(schema.opportunities.id, ids));
  const opps = new Map<string, OpportunityRow>();
  for (const o of oppRows) opps.set(o.id, o);
  return { sources: allSources, opps };
}

/** Replace the canonical opportunity's child rows from the candidate. */
async function refreshChildRows(
  tx: Tx,
  opportunityId: string,
  candidate: CanonicalCandidate,
  data: DeduplicationJobData,
): Promise<void> {
  await tx
    .delete(schema.opportunityLocations)
    .where(eq(schema.opportunityLocations.opportunityId, opportunityId));
  if (candidate.locations.length > 0) {
    await tx.insert(schema.opportunityLocations).values(
      candidate.locations.map((loc) => ({
        opportunityId,
        value: loc.raw,
        normalizedValue: loc.raw.toLowerCase(),
        city: loc.city ?? null,
        region: loc.region ?? null,
        country: loc.country ?? null,
        isRemote: loc.isRemote,
      })),
    );
  }

  await tx
    .delete(schema.opportunitySkills)
    .where(eq(schema.opportunitySkills.opportunityId, opportunityId));
  if (data.skills && data.skills.length > 0) {
    await tx
      .insert(schema.opportunitySkills)
      .values(data.skills.map((value) => ({ opportunityId, value })));
  }

  await tx
    .delete(schema.opportunityRequirements)
    .where(eq(schema.opportunityRequirements.opportunityId, opportunityId));
  if (data.requirements && data.requirements.length > 0) {
    await tx
      .insert(schema.opportunityRequirements)
      .values(data.requirements.map((value) => ({ opportunityId, value })));
  }

  const html = data.descriptionHtml;
  const sanitized = html !== undefined ? sanitizeHtml(html) : null; // XSS defense (Req 33.4)
  await tx
    .insert(schema.opportunityContent)
    .values({
      opportunityId,
      descriptionHtmlSanitized: sanitized,
      descriptionText: html !== undefined ? stripHtml(html) : null,
    })
    .onConflictDoUpdate({
      target: schema.opportunityContent.opportunityId,
      set: {
        descriptionHtmlSanitized: sanitized,
        descriptionText: html !== undefined ? stripHtml(html) : null,
      },
    });
}

/** Upsert the retained source row + refresh its evidence (Req 34, 37). */
async function persistSourceAndEvidence(
  tx: Tx,
  opportunityId: string,
  candidate: CanonicalCandidate,
  data: DeduplicationJobData,
): Promise<string> {
  const [srcRow] = await tx
    .insert(schema.opportunitySources)
    .values({
      opportunityId,
      rawArtifactId: data.rawArtifactId,
      sourceType: candidate.sourceType,
      isFirstParty: candidate.isFirstParty,
      externalId: candidate.externalId,
      sourceUrl: candidate.source.sourceUrl,
      applyUrl: candidate.applyUrl ?? null,
      atsBoard: candidate.atsBoard ?? null,
      atsPostingId: candidate.atsPostingId ?? null,
      fingerprint: candidate.fingerprint,
      confidence: num(candidate.evidenceConfidence),
    })
    .onConflictDoUpdate({
      target: [schema.opportunitySources.sourceType, schema.opportunitySources.externalId],
      set: {
        opportunityId,
        rawArtifactId: data.rawArtifactId,
        sourceUrl: candidate.source.sourceUrl,
        applyUrl: candidate.applyUrl ?? null,
        fingerprint: candidate.fingerprint,
        confidence: num(candidate.evidenceConfidence),
      },
    })
    .returning({ id: schema.opportunitySources.id });
  if (!srcRow) throw new Error('Failed to upsert opportunity source');

  await tx
    .delete(schema.opportunityEvidence)
    .where(eq(schema.opportunityEvidence.opportunitySourceId, srcRow.id));
  if (candidate.evidence.length > 0) {
    await tx.insert(schema.opportunityEvidence).values(
      candidate.evidence.map((e) => ({
        opportunitySourceId: srcRow.id,
        field: e.field,
        valueJson: null,
        sourceText: e.sourceText,
        method: e.method,
        confidence: e.confidence.toString(),
        uncertain: e.uncertain,
      })),
    );
  }
  return srcRow.id;
}

export async function runDedup(
  ctx: PipelineContext,
  data: DeduplicationJobData,
): Promise<{ opportunityId: string; created: boolean }> {
  const candidate = data.candidate;
  const now = new Date();
  const contentHash = canonicalContentHash(candidate);

  const outcome = await ctx.db.transaction(async (tx) => {
    const { sources, opps } = await gatherNeighborhood(tx, candidate);

    // Map reconstructed candidate keys back to their stored source/opportunity.
    const keyToSource = new Map<string, { sourceId: string; opportunityId: string }>();
    const existing: DedupCandidate[] = [];
    for (const s of sources) {
      const opp = opps.get(s.opportunityId);
      if (!opp) continue;
      const ec = existingCandidate(s, opp);
      existing.push(ec);
      keyToSource.set(ec.key, { sourceId: s.id, opportunityId: s.opportunityId });
    }

    const { groups, review } = deduplicate([candidate, ...existing]);
    const group = groups.find((g) => g.memberKeys.includes(candidate.key));
    if (!group) throw new Error('deduplicate() dropped the new candidate');

    // Existing opportunities implicated by this group.
    const groupOppIds = new Set<string>();
    for (const key of group.memberKeys) {
      const ref = keyToSource.get(key);
      if (ref) groupOppIds.add(ref.opportunityId);
    }
    const existingOppIds = [...groupOppIds].sort();
    const writeCanonical = group.canonicalKey === candidate.key || existingOppIds.length === 0;

    let opportunityId: string;
    let created = false;

    if (existingOppIds.length === 0) {
      const [opp] = await tx
        .insert(schema.opportunities)
        .values({
          ...canonicalColumns(candidate, contentHash, now),
          firstSeenAt: now,
          status: 'New',
        })
        .returning({ id: schema.opportunities.id });
      if (!opp) throw new Error('Failed to insert opportunity');
      opportunityId = opp.id;
      created = true;
      await refreshChildRows(tx, opportunityId, candidate, data);
    } else {
      opportunityId = existingOppIds[0]!;
      const targetRow = opps.get(opportunityId)!;

      if (writeCanonical) {
        const nextSnapshot = snapshotFromCandidate(candidate);
        const changed = diffCanonicalFields(targetRow, nextSnapshot);
        await tx
          .update(schema.opportunities)
          .set({
            ...canonicalColumns(candidate, contentHash, now),
            isFirstParty: targetRow.isFirstParty || candidate.isFirstParty,
          })
          .where(eq(schema.opportunities.id, opportunityId));
        // Content-change → record a revision + advance last_updated_at (Req 39).
        if (changed.length > 0 && targetRow.contentHash && targetRow.contentHash !== contentHash) {
          await tx.insert(schema.contentRevisions).values({
            opportunityId,
            changedAt: now,
            changedFields: changed,
            previousContentHash: targetRow.contentHash,
            newContentHash: contentHash,
            rawArtifactId: data.rawArtifactId,
          });
        }
        await refreshChildRows(tx, opportunityId, candidate, data);
      } else {
        // Existing canonical (first-party) wins: keep fields, just link + touch.
        await tx
          .update(schema.opportunities)
          .set({
            lastUpdatedAt: now,
            isFirstParty: targetRow.isFirstParty || candidate.isFirstParty,
          })
          .where(eq(schema.opportunities.id, opportunityId));
      }

      // Merge any other existing opportunities in the group into the target.
      for (const otherId of existingOppIds.slice(1)) {
        await tx
          .update(schema.opportunitySources)
          .set({ opportunityId })
          .where(eq(schema.opportunitySources.opportunityId, otherId));
        await tx
          .update(schema.opportunities)
          .set({ status: 'Duplicate', lastUpdatedAt: now })
          .where(eq(schema.opportunities.id, otherId));
      }
    }

    await persistSourceAndEvidence(tx, opportunityId, candidate, data);

    // Duplicate group linkage when the group has more than one member (Req 36.2).
    if (group.memberKeys.length > 1) {
      const [dg] = await tx
        .insert(schema.duplicateGroups)
        .values({ canonicalOpportunityId: opportunityId, strategy: group.stage })
        .returning({ id: schema.duplicateGroups.id });
      if (dg && existingOppIds.length > 0) {
        await tx
          .update(schema.opportunities)
          .set({ duplicateGroupId: dg.id })
          .where(inArray(schema.opportunities.id, [opportunityId, ...existingOppIds.slice(1)]));
      } else if (dg) {
        await tx
          .update(schema.opportunities)
          .set({ duplicateGroupId: dg.id })
          .where(eq(schema.opportunities.id, opportunityId));
      }
    }

    // Uncertain fuzzy pairs involving this candidate → review (never merge; Req 36.3).
    const uncertain = review.filter((r) => r.keys.includes(candidate.key));
    if (uncertain.length > 0) {
      await tx.insert(schema.reviewQueueItems).values(
        uncertain.map((r) => ({
          kind: 'uncertain_duplicate',
          rawArtifactId: data.rawArtifactId,
          reason: `uncertain duplicate (confidence ${r.confidence.toFixed(3)})`,
          status: 'open',
        })),
      );
    }

    // Transactional outbox — committed atomically with the state above (Req 36/37).
    await tx.insert(schema.outboxEvents).values({
      aggregateType: 'opportunity',
      aggregateId: opportunityId,
      eventType: created ? 'opportunity.created' : 'opportunity.updated',
      payload: {
        opportunityId,
        canonicalUrl: candidate.canonicalUrl,
        sourceType: candidate.sourceType,
        isFirstParty: candidate.isFirstParty,
        fingerprint: candidate.fingerprint,
      },
      correlationId: data.correlationId,
    });

    return { opportunityId, created };
  });

  // A non-open source signal → hand the opportunity to closure evaluation (Req 38).
  if (data.closureSignal && data.closureSignal !== 'open') {
    await ctx.queues.expiryCheck.add(
      'expiry-check',
      {
        correlationId: data.correlationId,
        opportunityId: outcome.opportunityId,
        closureSignal: data.closureSignal,
        rawArtifactId: data.rawArtifactId,
      },
      { jobId: `expiry:${outcome.opportunityId}:${contentHash.slice(0, 12)}` },
    );
  }

  ctx.logger.info('dedup.persisted', {
    stage: 'dedup',
    outcome: 'success',
    correlationId: data.correlationId,
    connectionId: data.connectionId,
    opportunityId: outcome.opportunityId,
    created: outcome.created,
  });
  return outcome;
}
