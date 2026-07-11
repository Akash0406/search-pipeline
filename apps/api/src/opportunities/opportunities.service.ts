/**
 * Opportunity domain service (Task 11.1, Req 40, 43, 45, 46, 58.3).
 *
 * Maps repository rows onto the shared contract DTOs and owns the two display
 * rules for this slice:
 *
 * - Per-user overlay (Req 43): every list/detail item carries the caller's
 *   `userState` (`none` | `saved` | `dismissed`), read from
 *   `opportunity_user_state` scoped to the caller (Req 43.4).
 * - Display status (Req 46.1): the label is the canonical stored status UNLESS
 *   the user has saved/dismissed the opportunity, in which case the per-user
 *   overlay wins (`Saved` / `Dismissed`). The result is always a member of the
 *   fixed display vocabulary. Timestamps are emitted as ISO strings; timezone
 *   formatting happens in the UI (Req 46.3).
 *
 * Save/dismiss are reversible and per-user (Req 43.1–43.4): setting upserts the
 * overlay; reversing clears just that overlay kind and reports the resulting
 * state.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CanonicalStatus,
  DisplayStatus,
  EmploymentType,
  Evidence,
  ExplorerState,
  ExtractionMethod,
  OpportunityDetail,
  OpportunityListItem,
  OpportunityListResponse,
  OpportunitySourceRef,
  OpportunityUserStateResponse,
  SalaryRange,
  Seniority,
  SourceType,
  UserState,
  WorkArrangement,
} from '@careerstack/contracts';
import {
  OpportunityRepository,
  type ListPagination,
  type OpportunityDetailRow,
  type OpportunityEvidenceRow,
  type OpportunityListRow,
  type OpportunityScalarRow,
  type OpportunitySourceRow,
  type StoredUserState,
} from './opportunity.repository.js';

@Injectable()
export class OpportunitiesService {
  constructor(private readonly repo: OpportunityRepository) {}

  /**
   * Explorer list (Req 40–42, 58.3): filtered, sorted, cursor-paginated, and
   * projected WITHOUT `description`. Each item carries the caller's overlay and
   * computed display status.
   */
  async list(
    userId: string,
    state: ExplorerState,
    pagination: ListPagination,
  ): Promise<OpportunityListResponse> {
    const page = await this.repo.list(userId, state, pagination);
    return {
      data: page.items.map((item) => this.toListItem(item)),
      page: { nextCursor: page.nextCursor, hasMore: page.hasMore },
    };
  }

  /** Full detail (Req 45): description + contributing sources + evidence. */
  async detail(userId: string, id: string): Promise<OpportunityDetail> {
    const row = await this.repo.findDetail(userId, id);
    if (!row) throw this.notFound();
    return this.toDetail(row);
  }

  /** Save an opportunity for the caller (Req 43.1). */
  async save(userId: string, id: string): Promise<OpportunityUserStateResponse> {
    await this.ensureExists(id);
    await this.repo.setUserState(userId, id, 'saved');
    return { opportunityId: id, state: 'saved' };
  }

  /** Reverse a save, clearing the overlay back to `none` (Req 43.3). */
  async unsave(userId: string, id: string): Promise<OpportunityUserStateResponse> {
    await this.ensureExists(id);
    await this.repo.clearUserState(userId, id, 'saved');
    return { opportunityId: id, state: this.toUserState(await this.repo.getUserState(userId, id)) };
  }

  /** Dismiss an opportunity for the caller (Req 43.2). */
  async dismiss(userId: string, id: string): Promise<OpportunityUserStateResponse> {
    await this.ensureExists(id);
    await this.repo.setUserState(userId, id, 'dismissed');
    return { opportunityId: id, state: 'dismissed' };
  }

  /** Reverse a dismiss, clearing the overlay back to `none` (Req 43.3). */
  async undismiss(userId: string, id: string): Promise<OpportunityUserStateResponse> {
    await this.ensureExists(id);
    await this.repo.clearUserState(userId, id, 'dismissed');
    return { opportunityId: id, state: this.toUserState(await this.repo.getUserState(userId, id)) };
  }

  // -- mapping -------------------------------------------------------------

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.repo.exists(id))) throw this.notFound();
  }

  private toListItem(row: OpportunityListRow): OpportunityListItem {
    const userState = this.toUserState(row.userState);
    const status = row.status as CanonicalStatus;

    const item: OpportunityListItem = {
      id: row.id,
      title: row.title,
      company: row.company,
      canonicalUrl: row.canonicalUrl ?? '',
      locations: row.locations,
      status,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastUpdatedAt: row.lastUpdatedAt.toISOString(),
      isFirstParty: row.isFirstParty,
      userState,
      displayStatus: this.toDisplayStatus(status, userState),
    };

    if (row.applyUrl) item.applyUrl = row.applyUrl;
    if (row.workArrangement) item.workArrangement = row.workArrangement as WorkArrangement;
    if (row.employmentType) item.employmentType = row.employmentType as EmploymentType;
    if (row.seniority) item.seniority = row.seniority as Seniority;
    if (row.postedAt) item.postedAt = row.postedAt.toISOString();
    if (row.closingAt) item.closingAt = row.closingAt.toISOString();
    if (row.duplicateGroupId) item.duplicateGroupId = row.duplicateGroupId;

    const salary = this.toSalary(row);
    if (salary) item.salary = salary;

    return item;
  }

  private toDetail(row: OpportunityDetailRow): OpportunityDetail {
    const base = this.toListItem({
      ...row.opportunity,
      userState: row.userState,
      locations: row.locations,
    });

    const detail: OpportunityDetail = {
      ...base,
      sources: row.sources.map((s) => this.toSourceRef(s)),
      evidence: row.evidence.map((e) => this.toEvidence(e)),
    };
    if (row.description) detail.description = row.description;
    return detail;
  }

  private toSourceRef(source: OpportunitySourceRow): OpportunitySourceRef {
    const ref: OpportunitySourceRef = {
      id: source.id,
      sourceType: source.sourceType as SourceType,
      externalId: source.externalId ?? '',
      sourceUrl: source.sourceUrl ?? '',
      isFirstParty: source.isFirstParty,
    };
    if (source.applyUrl) ref.applyUrl = source.applyUrl;
    if (source.rawArtifactId) ref.rawArtifactId = source.rawArtifactId;
    if (source.confidence !== null) ref.confidence = clamp01(Number(source.confidence));
    return ref;
  }

  private toEvidence(evidence: OpportunityEvidenceRow): Evidence {
    return {
      field: evidence.field,
      rawArtifactId: evidence.rawArtifactId ?? '',
      sourceText: evidence.sourceText ?? '',
      method: evidence.method as ExtractionMethod,
      confidence: clamp01(Number(evidence.confidence)),
      uncertain: evidence.uncertain,
    };
  }

  /** Overlay text (DB) → the public `none | saved | dismissed` vocabulary. */
  private toUserState(state: StoredUserState | null): UserState {
    return state ?? 'none';
  }

  /**
   * Compute the display label (Req 46.1): the per-user overlay wins over the
   * canonical status when present, otherwise the canonical status stands.
   */
  private toDisplayStatus(status: CanonicalStatus, userState: UserState): DisplayStatus {
    if (userState === 'saved') return 'Saved';
    if (userState === 'dismissed') return 'Dismissed';
    return status;
  }

  /** Build a salary range only when the source provided at least one field. */
  private toSalary(row: OpportunityScalarRow): SalaryRange | null {
    const hasSalary =
      row.salaryMin !== null ||
      row.salaryMax !== null ||
      row.salaryCurrency !== null ||
      row.salaryPeriod !== null;
    if (!hasSalary) return null;

    const salary: SalaryRange = {};
    if (row.salaryMin !== null) salary.min = Number(row.salaryMin);
    if (row.salaryMax !== null) salary.max = Number(row.salaryMax);
    if (row.salaryCurrency !== null) salary.currency = row.salaryCurrency;
    if (row.salaryPeriod !== null) salary.period = row.salaryPeriod as SalaryRange['period'];
    return salary;
  }

  private notFound(): NotFoundException {
    return new NotFoundException('Opportunity not found.');
  }
}

/** Clamp a confidence value into the contract's `[0, 1]` range. */
function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}
