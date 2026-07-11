/**
 * Deduplication engine (pure) — Task 10.2, Design §4, Req 36/37.
 *
 * A three-stage cascade over Opportunity_Source candidates (Req 36.1):
 *   1. EXACT-IDENTITY — same `(source_type, external_id)`, identical canonical
 *      URL, identical apply URL, or `(ats_board, ats_posting_id)`.
 *   2. NORMALIZED-FINGERPRINT — equal fingerprints merge (Req 36.1 stage 2).
 *   3. FUZZY — title + company + location similarity → confidence.
 *      `>= mergeThreshold` merges; `[reviewThreshold, mergeThreshold)` routes to
 *      review (never auto-merged, Req 36.3); `< reviewThreshold` is distinct.
 *
 * Guarantees (Properties 2, 3):
 *  - DETERMINISTIC — no clock/RNG; all iteration order is derived from a sorted
 *    copy of the input keys.
 *  - IDEMPOTENT — a pure function of the candidate set: re-running over the same
 *    set (or over a resolved set) yields an identical grouping.
 *  - ORDER-INDEPENDENT — grouping is computed with union-find, whose connected
 *    components do not depend on input order; fuzzy merges are collected across
 *    ALL pairs and applied together, and review pairs are filtered AFTER all
 *    merges settle. Outputs are returned in sorted order.
 *
 * Provenance (Req 37.1): the engine only GROUPS and selects which member is
 * canonical. It never discards a source — every input key appears in exactly
 * one group's `memberKeys`.
 */

import { companySimilarity, locationProximity, titleSimilarity } from './similarity.js';
import type { DedupCandidate } from './types.js';

/** Tunable thresholds + fuzzy weights (injected for testability). */
export interface DedupConfig {
  /** Confidence `>=` this auto-merges a fuzzy pair. */
  mergeThreshold: number;
  /** Confidence in `[reviewThreshold, mergeThreshold)` routes to review. */
  reviewThreshold: number;
  /** Fuzzy signal weights (normalized internally; must sum > 0). */
  weights?: { title: number; company: number; location: number };
}

/** Sensible defaults (Design §4). */
export const DEFAULT_DEDUP_CONFIG: DedupConfig = {
  mergeThreshold: 0.85,
  reviewThreshold: 0.6,
  weights: { title: 0.5, company: 0.35, location: 0.15 },
};

/** Which cascade stage first grouped a set of members. */
export type DedupStage = 'exact' | 'fingerprint' | 'fuzzy';

/** A resolved group of one-or-more sources representing one opportunity. */
export interface DedupGroup {
  /** Deterministic group id: the lexicographically smallest member key. */
  groupId: string;
  /** The member whose field values become canonical (first-party-wins, Req 36.4). */
  canonicalKey: string;
  /** Every contributing source key, sorted (all retained — Req 37.1). */
  memberKeys: string[];
  /** The strongest stage that contributed to forming this group. */
  stage: DedupStage;
}

/** A fuzzy pair that was confident enough to review but NOT to auto-merge. */
export interface ReviewPair {
  /** The two candidate keys, sorted. */
  keys: [string, string];
  /** The computed similarity confidence. */
  confidence: number;
  reason: 'uncertain_duplicate';
}

/** Output of {@link deduplicate}. */
export interface DedupResult {
  /** Resolved groups, sorted by `groupId`. Every input key appears once. */
  groups: DedupGroup[];
  /** Uncertain fuzzy pairs routed to review, sorted. */
  review: ReviewPair[];
}

// --- Union-find -------------------------------------------------------------

class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly rank = new Map<string, number>();

  add(key: string): void {
    if (!this.parent.has(key)) {
      this.parent.set(key, key);
      this.rank.set(key, 0);
    }
  }

  find(key: string): string {
    let root = key;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root) as string;
    }
    // Path compression (does not affect determinism of components).
    let cur = key;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur) as string;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const rankA = this.rank.get(ra) as number;
    const rankB = this.rank.get(rb) as number;
    // Union by rank, with a lexicographic tie-break for full determinism.
    let winner: string;
    let loser: string;
    if (rankA > rankB) {
      winner = ra;
      loser = rb;
    } else if (rankB > rankA) {
      winner = rb;
      loser = ra;
    } else {
      winner = ra < rb ? ra : rb;
      loser = ra < rb ? rb : ra;
      this.rank.set(winner, rankA + 1);
    }
    this.parent.set(loser, winner);
  }
}

// --- Confidence -------------------------------------------------------------

/** Weighted fuzzy confidence in [0, 1] for a pair of candidates. */
export function fuzzyConfidence(
  a: DedupCandidate,
  b: DedupCandidate,
  config: DedupConfig = DEFAULT_DEDUP_CONFIG,
): number {
  const w = config.weights ?? DEFAULT_DEDUP_CONFIG.weights!;
  const total = w.title + w.company + w.location;
  if (total <= 0) return 0;
  const title = titleSimilarity(a.normalizedTitle, b.normalizedTitle);
  const company = companySimilarity(a.normalizedCompany, b.normalizedCompany);
  const location = locationProximity(a.locationKey, b.locationKey);
  const score = (title * w.title + company * w.company + location * w.location) / total;
  return Math.min(1, Math.max(0, score));
}

// --- Engine -----------------------------------------------------------------

function identityTokens(c: DedupCandidate): string[] {
  const tokens = [`st:${c.sourceType}\u0001${c.externalId}`, `url:${c.canonicalUrl}`];
  if (c.applyUrl) tokens.push(`apply:${c.applyUrl}`);
  if (c.atsBoard && c.atsPostingId) {
    tokens.push(`ats:${c.atsBoard}\u0001${c.atsPostingId}`);
  }
  return tokens;
}

/**
 * Choose the canonical member of a group (Req 36.4):
 *   1. first-party sources beat aggregators;
 *   2. then higher aggregate evidence confidence;
 *   3. then most recent `updatedAt`;
 *   4. then lexicographically smallest key (stable, deterministic tie-break).
 */
function chooseCanonical(members: DedupCandidate[]): string {
  const sorted = [...members].sort((a, b) => {
    if (a.isFirstParty !== b.isFirstParty) return a.isFirstParty ? -1 : 1;
    if (a.evidenceConfidence !== b.evidenceConfidence) {
      return b.evidenceConfidence - a.evidenceConfidence;
    }
    const au = a.updatedAt ?? '';
    const bu = b.updatedAt ?? '';
    if (au !== bu) return au > bu ? -1 : 1;
    return a.key < b.key ? -1 : 1;
  });
  return sorted[0]!.key;
}

/**
 * Deduplicate Opportunity_Source candidates into canonical groups + review
 * pairs. Pure, deterministic, idempotent and order-independent.
 */
export function deduplicate(
  candidates: readonly DedupCandidate[],
  config: DedupConfig = DEFAULT_DEDUP_CONFIG,
): DedupResult {
  // Work from a key-sorted copy so all downstream iteration is order-independent.
  const items = [...candidates].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const uf = new UnionFind();
  for (const c of items) uf.add(c.key);

  // Track the strongest stage that unions each pair, so a group's `stage`
  // reflects the most authoritative signal that formed it.
  const stageRank: Record<DedupStage, number> = { exact: 3, fingerprint: 2, fuzzy: 1 };
  const memberStage = new Map<string, DedupStage>(); // per-key best stage seen

  const recordStage = (key: string, stage: DedupStage): void => {
    const prev = memberStage.get(key);
    if (!prev || stageRank[stage] > stageRank[prev]) memberStage.set(key, stage);
  };

  // --- Stage 1: exact-identity (shared identity token) ----------------------
  const tokenOwner = new Map<string, string>(); // token -> first key that used it
  for (const c of items) {
    for (const token of identityTokens(c)) {
      const owner = tokenOwner.get(token);
      if (owner === undefined) {
        tokenOwner.set(token, c.key);
      } else {
        uf.union(owner, c.key);
        recordStage(owner, 'exact');
        recordStage(c.key, 'exact');
      }
    }
  }

  // --- Stage 2: normalized-fingerprint --------------------------------------
  const fpOwner = new Map<string, string>();
  for (const c of items) {
    const owner = fpOwner.get(c.fingerprint);
    if (owner === undefined) {
      fpOwner.set(c.fingerprint, c.key);
    } else {
      uf.union(owner, c.key);
      recordStage(owner, 'fingerprint');
      recordStage(c.key, 'fingerprint');
    }
  }

  // --- Stage 3: fuzzy (collect all pairs first, apply together) -------------
  interface ScoredPair {
    a: string;
    b: string;
    confidence: number;
  }
  const mergePairs: ScoredPair[] = [];
  const reviewCandidates: ScoredPair[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      // Skip pairs already grouped by exact/fingerprint stages.
      if (uf.find(a.key) === uf.find(b.key)) continue;
      const confidence = fuzzyConfidence(a, b, config);
      if (confidence >= config.mergeThreshold) {
        mergePairs.push({ a: a.key, b: b.key, confidence });
      } else if (confidence >= config.reviewThreshold) {
        reviewCandidates.push({ a: a.key, b: b.key, confidence });
      }
    }
  }
  for (const pair of mergePairs) {
    uf.union(pair.a, pair.b);
    recordStage(pair.a, 'fuzzy');
    recordStage(pair.b, 'fuzzy');
  }

  // Review pairs: keep only those still in DIFFERENT components after all
  // merges settled (Req 36.3 — never auto-merge; surface uncertainty).
  const review: ReviewPair[] = [];
  for (const pair of reviewCandidates) {
    if (uf.find(pair.a) === uf.find(pair.b)) continue;
    const keys: [string, string] = pair.a < pair.b ? [pair.a, pair.b] : [pair.b, pair.a];
    review.push({ keys, confidence: pair.confidence, reason: 'uncertain_duplicate' });
  }
  review.sort((x, y) =>
    x.keys[0] === y.keys[0] ? (x.keys[1] < y.keys[1] ? -1 : 1) : x.keys[0] < y.keys[0] ? -1 : 1,
  );

  // --- Assemble groups ------------------------------------------------------
  const componentMembers = new Map<string, DedupCandidate[]>();
  for (const c of items) {
    const root = uf.find(c.key);
    const list = componentMembers.get(root);
    if (list) list.push(c);
    else componentMembers.set(root, [c]);
  }

  const groups: DedupGroup[] = [];
  for (const members of componentMembers.values()) {
    const memberKeys = members.map((m) => m.key).sort((a, b) => (a < b ? -1 : 1));
    const groupId = memberKeys[0]!;
    const canonicalKey = chooseCanonical(members);
    // A group's stage = strongest stage recorded across its members
    // (singletons were never unioned, so they are `exact` identity of one).
    let stage: DedupStage = 'exact';
    let best = 0;
    for (const key of memberKeys) {
      const s = memberStage.get(key);
      if (s && stageRank[s] > best) {
        best = stageRank[s];
        stage = s;
      }
    }
    groups.push({ groupId, canonicalKey, memberKeys, stage });
  }
  groups.sort((a, b) => (a.groupId < b.groupId ? -1 : a.groupId > b.groupId ? 1 : 0));

  return { groups, review };
}
