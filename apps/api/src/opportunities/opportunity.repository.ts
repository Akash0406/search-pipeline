/**
 * Explorer filter + sort query builder and per-user state access (Task 11.2,
 * Req 41.1–41.5, 42.1–42.3, 43.1–43.4, 58.1/58.3).
 *
 * Canonical opportunities are GLOBAL (not user-owned), so the list/detail reads
 * are not ownership-scoped. The per-user overlay lives in
 * `opportunity_user_state` (PK `(user_id, opportunity_id)`) and is ALWAYS
 * scoped to the current user via the `user_id` predicate (Req 43.4) — a
 * left-join for the overlay and an explicit `WHERE user_id = :userId` on every
 * save/dismiss mutation.
 *
 * Design: Data Models → Indexing strategy. Filters/sort map onto the indexed
 * columns (`(status, last_updated_at desc)`, `(company)`, `(first_seen_at)`,
 * partial `(closing_at)`, `(fingerprint)`, `opportunity_user_state(user_id,
 * state)`).
 *
 * CRITICAL (Req 40.3 / 58.3 / Property 21): the LIST projection selects a fixed
 * set of scalar columns and NEVER touches `opportunity_content`, so the heavy
 * `description` can never leak into a collection response. It is joined only in
 * {@link OpportunityRepository.findDetail}.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Database } from '@careerstack/database';
import {
  opportunities,
  opportunityContent,
  opportunityEvidence,
  opportunityLocations,
  opportunitySources,
  opportunityUserState,
} from '@careerstack/database';
import type { ExplorerFreshness, ExplorerSortKey, ExplorerState } from '@careerstack/contracts';
import { DB } from '../common/di-tokens.js';

/** Per-user overlay stored on `opportunity_user_state.state`. */
export type StoredUserState = 'saved' | 'dismissed';

/** Scalar opportunity columns — the description-free list/detail projection. */
export interface OpportunityScalarRow {
  id: string;
  title: string;
  company: string;
  canonicalUrl: string | null;
  applyUrl: string | null;
  workArrangement: string | null;
  employmentType: string | null;
  seniority: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  postedAt: Date | null;
  firstSeenAt: Date;
  closingAt: Date | null;
  lastUpdatedAt: Date;
  status: string;
  isFirstParty: boolean;
  duplicateGroupId: string | null;
}

/** A list row: scalar projection + the caller's overlay + flattened locations. */
export interface OpportunityListRow extends OpportunityScalarRow {
  userState: StoredUserState | null;
  locations: string[];
}

/** One page of the explorer list plus the opaque keyset cursor. */
export interface OpportunityListPage {
  items: OpportunityListRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** A contributing source retained after merge (Req 37, 45.2). */
export interface OpportunitySourceRow {
  id: string;
  sourceType: string;
  externalId: string | null;
  sourceUrl: string | null;
  applyUrl: string | null;
  isFirstParty: boolean;
  rawArtifactId: string | null;
  confidence: string | null;
}

/** Provenance per populated fact, with the parent source's artifact ref. */
export interface OpportunityEvidenceRow {
  field: string;
  rawArtifactId: string | null;
  sourceText: string | null;
  method: string;
  confidence: string;
  uncertain: boolean;
}

/** Full detail bundle (Req 45): scalar row + description + provenance. */
export interface OpportunityDetailRow {
  opportunity: OpportunityScalarRow;
  userState: StoredUserState | null;
  description: string | null;
  locations: string[];
  sources: OpportunitySourceRow[];
  evidence: OpportunityEvidenceRow[];
}

/** Cursor pagination options for the list. */
export interface ListPagination {
  cursor?: string | undefined;
  limit?: number | undefined;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** Freshness windows (Req 41.4) → lookback in milliseconds, by `first_seen_at`. */
const FRESHNESS_MS: Record<ExplorerFreshness, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

/** Sort key → sort column + direction (Task 11.2, Req 42.1). */
interface SortConfig {
  column: PgColumn;
  direction: 'asc' | 'desc';
  /** `closingSoon` orders `closing_at asc nulls last`. */
  nullsLast?: boolean;
}
const SORT_CONFIG: Record<ExplorerSortKey, SortConfig> = {
  newest: { column: opportunities.firstSeenAt, direction: 'desc' },
  newlyDiscovered: { column: opportunities.firstSeenAt, direction: 'desc' },
  closingSoon: { column: opportunities.closingAt, direction: 'asc', nullsLast: true },
  recentlyUpdated: { column: opportunities.lastUpdatedAt, direction: 'desc' },
};
const DEFAULT_SORT: ExplorerSortKey = 'newest';

/** Opaque, stable keyset cursor payload: sort-value (epoch ms | null) + id. */
interface CursorPayload {
  v: number | null;
  id: string;
}

@Injectable()
export class OpportunityRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Run the explorer query: apply all active filters, order by the selected
   * sort key with a stable id tiebreaker, and page via an opaque keyset cursor.
   * The projection excludes `description` (Req 40.3 / 58.3).
   */
  async list(
    userId: string,
    state: ExplorerState,
    pagination: ListPagination,
  ): Promise<OpportunityListPage> {
    const sortKey = state.sort ?? DEFAULT_SORT;
    const limit = clamp(pagination.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);

    const conditions = this.buildFilters(state);
    const cursor = pagination.cursor ? decodeCursor(pagination.cursor) : null;
    if (cursor) {
      const keyset = this.buildKeysetCondition(sortKey, cursor);
      if (keyset) conditions.push(keyset);
    }
    const where = and(...conditions.filter((c): c is SQL => c !== undefined));

    const rows = await this.db
      .select(this.listSelection())
      .from(opportunities)
      .leftJoin(
        opportunityUserState,
        and(
          eq(opportunityUserState.opportunityId, opportunities.id),
          eq(opportunityUserState.userId, userId),
        ),
      )
      .where(where)
      .orderBy(...this.buildOrderBy(sortKey))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const locationsById = await this.loadLocations(pageRows.map((r) => r.id));
    const items: OpportunityListRow[] = pageRows.map((r) => ({
      ...r,
      userState: normalizeUserState(r.userState),
      locations: locationsById.get(r.id) ?? [],
    }));

    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ v: this.cursorValueForRow(sortKey, last), id: last.id })
        : null;

    return { items, nextCursor, hasMore };
  }

  /**
   * Full detail for one opportunity (Req 45): scalar row + sanitized
   * description (joined from `opportunity_content`), the caller's overlay,
   * locations, contributing sources, and per-fact evidence. Returns `null` when
   * the opportunity does not exist.
   */
  async findDetail(userId: string, id: string): Promise<OpportunityDetailRow | null> {
    const [row] = await this.db
      .select({
        ...this.scalarColumns(),
        userState: opportunityUserState.state,
        description: opportunityContent.descriptionHtmlSanitized,
      })
      .from(opportunities)
      .leftJoin(
        opportunityUserState,
        and(
          eq(opportunityUserState.opportunityId, opportunities.id),
          eq(opportunityUserState.userId, userId),
        ),
      )
      .leftJoin(opportunityContent, eq(opportunityContent.opportunityId, opportunities.id))
      .where(eq(opportunities.id, id))
      .limit(1);

    if (!row) return null;

    const { userState, description, ...scalar } = row;

    const [locationsById, sources, evidence] = await Promise.all([
      this.loadLocations([id]),
      this.loadSources(id),
      this.loadEvidence(id),
    ]);

    return {
      opportunity: scalar,
      userState: normalizeUserState(userState),
      description: description ?? null,
      locations: locationsById.get(id) ?? [],
      sources,
      evidence,
    };
  }

  /** Whether a canonical opportunity exists (guards save/dismiss with 404). */
  async exists(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.id, id))
      .limit(1);
    return Boolean(row);
  }

  /** The caller's current overlay for an opportunity, or `null` (Req 43.4). */
  async getUserState(userId: string, opportunityId: string): Promise<StoredUserState | null> {
    const [row] = await this.db
      .select({ state: opportunityUserState.state })
      .from(opportunityUserState)
      .where(
        and(
          eq(opportunityUserState.userId, userId),
          eq(opportunityUserState.opportunityId, opportunityId),
        ),
      )
      .limit(1);
    return normalizeUserState(row?.state ?? null);
  }

  /** Upsert the caller's overlay to `saved`/`dismissed` (Req 43.1, 43.2). */
  async setUserState(userId: string, opportunityId: string, state: StoredUserState): Promise<void> {
    await this.db
      .insert(opportunityUserState)
      .values({ userId, opportunityId, state })
      .onConflictDoUpdate({
        target: [opportunityUserState.userId, opportunityUserState.opportunityId],
        set: { state, updatedAt: new Date() },
      });
  }

  /**
   * Clear the caller's overlay when it matches `kind` (reversal, Req 43.3).
   * Scoping the delete by `state = :kind` means a `DELETE /save` never wipes a
   * standing dismiss (and vice-versa).
   */
  async clearUserState(
    userId: string,
    opportunityId: string,
    kind: StoredUserState,
  ): Promise<void> {
    await this.db
      .delete(opportunityUserState)
      .where(
        and(
          eq(opportunityUserState.userId, userId),
          eq(opportunityUserState.opportunityId, opportunityId),
          eq(opportunityUserState.state, kind),
        ),
      );
  }

  // -- query construction --------------------------------------------------

  /** Scalar column map (no `description`) — the projection source of truth. */
  private scalarColumns() {
    return {
      id: opportunities.id,
      title: opportunities.title,
      company: opportunities.company,
      canonicalUrl: opportunities.canonicalUrl,
      applyUrl: opportunities.applyUrl,
      workArrangement: opportunities.workArrangement,
      employmentType: opportunities.employmentType,
      seniority: opportunities.seniority,
      salaryMin: opportunities.salaryMin,
      salaryMax: opportunities.salaryMax,
      salaryCurrency: opportunities.salaryCurrency,
      salaryPeriod: opportunities.salaryPeriod,
      postedAt: opportunities.postedAt,
      firstSeenAt: opportunities.firstSeenAt,
      closingAt: opportunities.closingAt,
      lastUpdatedAt: opportunities.lastUpdatedAt,
      status: opportunities.status,
      isFirstParty: opportunities.isFirstParty,
      duplicateGroupId: opportunities.duplicateGroupId,
    };
  }

  /** List selection = scalar projection + the left-joined overlay state. */
  private listSelection() {
    return { ...this.scalarColumns(), userState: opportunityUserState.state };
  }

  /**
   * Translate every {@link ExplorerState} dimension into an indexed predicate
   * (Req 41). Absent dimensions add no constraint. `opportunityType` and
   * `roleProfileId` are accepted for forward-compatibility but are no-ops this
   * slice (there is no canonical opportunity-type column, and role-profile
   * scoping arrives with the matching engine).
   *
   * The saved/dismissed filters read the `opportunity_user_state` overlay that
   * `list()` left-joins scoped to the caller, so no `userId` is needed here.
   */
  private buildFilters(state: ExplorerState): Array<SQL | undefined> {
    const conditions: Array<SQL | undefined> = [];

    if (state.company) {
      // ILIKE without wildcards = case-insensitive exact match on the indexed
      // `company` column (Req 41.1).
      conditions.push(ilike(opportunities.company, state.company));
    }
    if (state.workArrangement) {
      conditions.push(eq(opportunities.workArrangement, state.workArrangement));
    }
    if (state.employmentType) {
      conditions.push(eq(opportunities.employmentType, state.employmentType));
    }
    if (state.seniority) {
      conditions.push(eq(opportunities.seniority, state.seniority));
    }
    if (state.duplicateGroupId) {
      conditions.push(eq(opportunities.duplicateGroupId, state.duplicateGroupId));
    }

    if (state.search) {
      const like = `%${escapeLike(state.search)}%`;
      conditions.push(or(ilike(opportunities.title, like), ilike(opportunities.company, like)));
    }

    if (state.location) {
      const like = `%${escapeLike(state.location)}%`;
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(opportunityLocations)
            .where(
              and(
                eq(opportunityLocations.opportunityId, opportunities.id),
                or(
                  ilike(opportunityLocations.value, like),
                  ilike(opportunityLocations.normalizedValue, like),
                ),
              ),
            ),
        ),
      );
    }

    if (state.source) {
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(opportunitySources)
            .where(
              and(
                eq(opportunitySources.opportunityId, opportunities.id),
                eq(opportunitySources.sourceType, state.source),
              ),
            ),
        ),
      );
    }

    const postedAfter = toDate(state.postedAfter);
    if (postedAfter) conditions.push(gte(opportunities.postedAt, postedAfter));
    const postedBefore = toDate(state.postedBefore);
    if (postedBefore) conditions.push(lte(opportunities.postedAt, postedBefore));

    const firstSeenAfter = toDate(state.firstSeenAfter);
    if (firstSeenAfter) conditions.push(gte(opportunities.firstSeenAt, firstSeenAfter));
    const firstSeenBefore = toDate(state.firstSeenBefore);
    if (firstSeenBefore) conditions.push(lte(opportunities.firstSeenAt, firstSeenBefore));

    const closesBefore = toDate(state.closesBefore);
    if (closesBefore) {
      conditions.push(
        and(isNotNull(opportunities.closingAt), lte(opportunities.closingAt, closesBefore)),
      );
    }

    if (state.freshness) {
      const since = new Date(Date.now() - FRESHNESS_MS[state.freshness]);
      conditions.push(gte(opportunities.firstSeenAt, since));
    }

    // Per-user state filters (Req 41.3). saved/dismissed read the left-joined
    // overlay (scoped to the caller); needsReview is a canonical status.
    if (state.state === 'saved') {
      conditions.push(eq(opportunityUserState.state, 'saved'));
    } else if (state.state === 'dismissed') {
      conditions.push(eq(opportunityUserState.state, 'dismissed'));
    } else if (state.state === 'needsReview') {
      conditions.push(eq(opportunities.status, 'Needs review'));
    }

    return conditions;
  }

  /**
   * ORDER BY for a sort key with a stable `id` tiebreaker so pagination is
   * deterministic even when the sort column ties (Req 42.2).
   */
  private buildOrderBy(sortKey: ExplorerSortKey): SQL[] {
    const cfg = SORT_CONFIG[sortKey];
    if (cfg.nullsLast) {
      return [sql`${cfg.column} asc nulls last`, asc(opportunities.id) as unknown as SQL];
    }
    return cfg.direction === 'desc'
      ? [desc(cfg.column) as unknown as SQL, desc(opportunities.id) as unknown as SQL]
      : [asc(cfg.column) as unknown as SQL, asc(opportunities.id) as unknown as SQL];
  }

  /**
   * Keyset predicate for "rows strictly after the cursor" under the selected
   * ordering. Handles the `closing_at asc nulls last` region split so the null
   * tail paginates correctly.
   */
  private buildKeysetCondition(sortKey: ExplorerSortKey, cursor: CursorPayload): SQL | undefined {
    const cfg = SORT_CONFIG[sortKey];
    const col = cfg.column;
    const id = opportunities.id;

    if (cfg.nullsLast) {
      if (cursor.v === null) {
        // Already in the trailing NULL region: only later-id NULLs remain.
        return and(isNull(col), lt(id, cursor.id)) as SQL;
      }
      const cv = new Date(cursor.v);
      return or(
        and(isNotNull(col), sql`${col} > ${cv}`),
        and(isNotNull(col), eq(col, cv), sql`${id} > ${cursor.id}`),
        isNull(col),
      ) as SQL;
    }

    if (cursor.v === null) return undefined;
    const cv = new Date(cursor.v);
    if (cfg.direction === 'desc') {
      return or(lt(col, cv), and(eq(col, cv), lt(id, cursor.id))) as SQL;
    }
    return or(sql`${col} > ${cv}`, and(eq(col, cv), sql`${id} > ${cursor.id}`)) as SQL;
  }

  /** The cursor sort-value for the last row of a page (epoch ms | null). */
  private cursorValueForRow(sortKey: ExplorerSortKey, row: OpportunityScalarRow): number | null {
    switch (sortKey) {
      case 'newest':
      case 'newlyDiscovered':
        return row.firstSeenAt.getTime();
      case 'recentlyUpdated':
        return row.lastUpdatedAt.getTime();
      case 'closingSoon':
        return row.closingAt ? row.closingAt.getTime() : null;
      default:
        return row.firstSeenAt.getTime();
    }
  }

  // -- child loads ---------------------------------------------------------

  /** Load locations for a set of opportunity ids (avoids row multiplication). */
  private async loadLocations(ids: string[]): Promise<Map<string, string[]>> {
    const byId = new Map<string, string[]>();
    if (ids.length === 0) return byId;
    const rows = await this.db
      .select({
        opportunityId: opportunityLocations.opportunityId,
        value: opportunityLocations.value,
      })
      .from(opportunityLocations)
      .where(inArray(opportunityLocations.opportunityId, ids));
    for (const r of rows) {
      const list = byId.get(r.opportunityId) ?? [];
      list.push(r.value);
      byId.set(r.opportunityId, list);
    }
    return byId;
  }

  /** Contributing sources for an opportunity, oldest first. */
  private async loadSources(opportunityId: string): Promise<OpportunitySourceRow[]> {
    return this.db
      .select({
        id: opportunitySources.id,
        sourceType: opportunitySources.sourceType,
        externalId: opportunitySources.externalId,
        sourceUrl: opportunitySources.sourceUrl,
        applyUrl: opportunitySources.applyUrl,
        isFirstParty: opportunitySources.isFirstParty,
        rawArtifactId: opportunitySources.rawArtifactId,
        confidence: opportunitySources.confidence,
      })
      .from(opportunitySources)
      .where(eq(opportunitySources.opportunityId, opportunityId))
      .orderBy(asc(opportunitySources.createdAt));
  }

  /**
   * Per-fact evidence for an opportunity (Req 34, 45.2). Joined to the parent
   * source so each evidence record carries the source's `raw_artifact_id`
   * (Evidence.rawArtifactId, OPP-003.1).
   */
  private async loadEvidence(opportunityId: string): Promise<OpportunityEvidenceRow[]> {
    return this.db
      .select({
        field: opportunityEvidence.field,
        rawArtifactId: opportunitySources.rawArtifactId,
        sourceText: opportunityEvidence.sourceText,
        method: opportunityEvidence.method,
        confidence: opportunityEvidence.confidence,
        uncertain: opportunityEvidence.uncertain,
      })
      .from(opportunityEvidence)
      .innerJoin(
        opportunitySources,
        eq(opportunitySources.id, opportunityEvidence.opportunitySourceId),
      )
      .where(eq(opportunitySources.opportunityId, opportunityId));
  }
}

// -- pure helpers ------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Coerce the DB `state` text to the stored overlay union, or `null`. */
function normalizeUserState(value: string | null | undefined): StoredUserState | null {
  return value === 'saved' || value === 'dismissed' ? value : null;
}

/** Escape LIKE/ILIKE metacharacters in user-supplied filter values. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Parse an ISO date filter value, returning `null` for absent/invalid input. */
function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Encode an opaque, URL-safe keyset cursor. */
function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** Decode a keyset cursor, tolerating hostile/garbage input (→ `null`). */
function decodeCursor(raw: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      typeof (parsed as { id: unknown }).id === 'string'
    ) {
      const { v, id } = parsed as { v: unknown; id: string };
      if (v === null || typeof v === 'number') {
        return { v, id };
      }
    }
    return null;
  } catch {
    return null;
  }
}
