/**
 * Role-profile domain service (Capability C, Req 10–19).
 *
 * Owns the invariants around the profile lifecycle while delegating all data
 * access to the ownership-scoped {@link RoleProfileRepository}:
 *
 * - Exactly one Active_Role_Profile per user, stored in
 *   `user_preferences.active_role_profile_id` (Req 10.2). Activating one
 *   replaces the single pointer, deactivating the previous (Req 10.3). The
 *   first profile a user creates auto-activates (Req 10.4).
 * - Ownership isolation: reads/writes for a foreign or missing profile surface
 *   as `NotFound` (Req 10.5, 19.4) — the repository never returns another
 *   user's rows.
 * - Salary is unspecified rather than zero when omitted (Req 15.3); work-rights
 *   are optional and stored verbatim, never inferred (Req 16.1, 16.4).
 * - Duplicate copies preferences into a new distinctly-named profile and leaves
 *   the active pointer unchanged (Req 17). Pause/resume toggle eligibility;
 *   pausing the active profile requires selecting a new active one (Req 18).
 *   Deleting the active profile auto-selects a replacement and signals that the
 *   user may pick a different one (Req 19.2, 19.3).
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateRoleProfileRequest,
  RoleProfileDetail,
  RoleProfileListItem,
  UpdateRoleProfileRequest,
} from '@careerstack/contracts';
import {
  RoleProfileRepository,
  type ChildCollections,
  type HydratedProfile,
  type ProfileRow,
  type ScalarFields,
} from './role-profile.repository.js';

/** Result of deleting a profile — signals a new-active-selection prompt. */
export interface DeleteRoleProfileResult {
  status: 'deleted';
  deletedId: string;
  /** Auto-selected replacement when the active profile was deleted (Req 19.3). */
  newActiveProfileId: string | null;
  /** True when the user should be prompted to pick a new active (Req 19.3). */
  requiresActiveSelection: boolean;
}

@Injectable()
export class RoleProfilesService {
  constructor(private readonly repo: RoleProfileRepository) {}

  /** List the user's profiles (compact items) with active flags (Req 10.1). */
  async list(userId: string): Promise<RoleProfileListItem[]> {
    const { profiles, activeId } = await this.repo.listForOwnerWithActive(userId);
    return profiles.map((p) => this.toListItem(p, activeId));
  }

  /** Fetch one owned profile in full, or 404 (Req 10.5, 19.4). */
  async getDetail(userId: string, id: string): Promise<RoleProfileDetail> {
    const result = await this.repo.findHydratedForOwner(id, userId);
    if (!result) throw this.notFound();
    return this.toDetail(result.hydrated, result.activeId);
  }

  /** Create a profile; the first one auto-activates (Req 10.4). */
  async create(userId: string, dto: CreateRoleProfileRequest): Promise<RoleProfileDetail> {
    const id = await this.repo.createWithChildren(
      userId,
      { name: dto.name, ...this.scalarsFromDto(dto) },
      this.childrenFromDto(dto),
    );
    return this.getDetail(userId, id);
  }

  /** Partial update with replace-on-update child semantics (Req 19.1). */
  async update(
    userId: string,
    id: string,
    dto: UpdateRoleProfileRequest,
  ): Promise<RoleProfileDetail> {
    const scalars: ScalarFields = {};
    if (dto.name !== undefined) scalars.name = dto.name;
    Object.assign(scalars, this.scalarsFromDto(dto));

    const updated = await this.repo.updateWithChildren(
      id,
      userId,
      scalars,
      this.childrenFromDto(dto),
    );
    if (!updated) throw this.notFound();
    return this.getDetail(userId, id);
  }

  /**
   * Delete an owned profile (Req 19.2 confirmation is enforced at the route).
   * If the active profile is deleted and others remain, auto-select the newest
   * active-eligible replacement and flag that the user may choose a different
   * one (Req 19.3). Keeps exactly one active (Req 10.2).
   */
  async delete(userId: string, id: string): Promise<DeleteRoleProfileResult> {
    const activeId = await this.repo.getActiveProfileId(userId);
    const deleting = await this.repo.deleteOwned(id, userId);
    if (!deleting) throw this.notFound();

    const wasActive = activeId === id;
    if (!wasActive) {
      return {
        status: 'deleted',
        deletedId: id,
        newActiveProfileId: null,
        requiresActiveSelection: false,
      };
    }

    // The DB cleared the active pointer (on delete set null). Pick a replacement
    // so the one-active invariant holds, preferring an active-eligible profile.
    const { profiles } = await this.repo.listForOwnerWithActive(userId);
    const replacement = profiles.find((p) => p.status === 'active') ?? profiles[0];
    if (!replacement) {
      return {
        status: 'deleted',
        deletedId: id,
        newActiveProfileId: null,
        requiresActiveSelection: false,
      };
    }
    await this.repo.setActive(userId, replacement.id);
    if (replacement.status !== 'active') {
      await this.repo.setStatus(replacement.id, userId, 'active');
    }
    return {
      status: 'deleted',
      deletedId: id,
      newActiveProfileId: replacement.id,
      requiresActiveSelection: true,
    };
  }

  /** Activate a profile: sets it active and deactivates the previous (Req 10.3). */
  async activate(userId: string, id: string): Promise<RoleProfileDetail> {
    const ok = await this.repo.activateOwned(id, userId);
    if (!ok) throw this.notFound();
    return this.getDetail(userId, id);
  }

  /**
   * Duplicate a profile: copy its preferences into a new profile with a distinct
   * name, leaving the active pointer unchanged (Req 17.1, 17.2, 17.3).
   */
  async duplicate(userId: string, id: string): Promise<RoleProfileDetail> {
    const source = await this.repo.findHydratedForOwner(id, userId);
    if (!source) throw this.notFound();

    const { hydrated } = source;
    const newName = await this.deriveDuplicateName(userId, hydrated.profile.name);

    // Create WITHOUT auto-activation semantics affecting the current active:
    // createWithChildren only auto-activates when the user has zero profiles,
    // which is impossible here (the source exists), so the active pointer is
    // left unchanged (Req 17.2).
    const newId = await this.repo.createWithChildren(
      userId,
      {
        name: newName,
        salaryMin: hydrated.profile.salaryMin,
        salaryMax: hydrated.profile.salaryMax,
        salaryCurrency: hydrated.profile.salaryCurrency,
        salaryPeriod: hydrated.profile.salaryPeriod,
        workRights: hydrated.profile.workRights,
      },
      {
        titles: hydrated.titles.map((t) => ({
          kind: t.kind as 'target' | 'excluded',
          value: t.value,
        })),
        skills: hydrated.skills.map((s) => ({
          kind: s.kind as 'required' | 'preferred',
          value: s.value,
        })),
        locations: hydrated.locations.map((l) => ({ value: l.value, isPrimary: l.isPrimary })),
        preferences: {
          workArrangements: hydrated.preferences?.workArrangements ?? [],
          employmentTypes: hydrated.preferences?.employmentTypes ?? [],
          seniorityLevels: hydrated.preferences?.seniorityLevels ?? [],
        },
      },
    );
    return this.getDetail(userId, newId);
  }

  /**
   * Pause a profile (Req 18.1). If it is the active profile, require a new
   * active selection first (Req 18.2): pass `activateProfileId` to activate a
   * different profile before pausing; otherwise a 409 asks the caller to choose
   * one. When it is the user's only profile, pausing clears the active pointer.
   */
  async pause(userId: string, id: string, activateProfileId?: string): Promise<RoleProfileDetail> {
    const activeId = await this.repo.getActiveProfileId(userId);
    const isActive = activeId === id;

    if (isActive) {
      const { profiles } = await this.repo.listForOwnerWithActive(userId);
      const others = profiles.filter((p) => p.id !== id);

      if (others.length > 0) {
        if (!activateProfileId) {
          throw new ConflictException(
            'Pausing the active profile requires selecting a different active profile first.',
          );
        }
        if (activateProfileId === id) {
          throw new ConflictException(
            'The replacement active profile must be a different profile.',
          );
        }
        const activated = await this.repo.activateOwned(activateProfileId, userId);
        if (!activated) {
          throw new NotFoundException('The selected replacement profile was not found.');
        }
      } else {
        // Only profile: pausing leaves no active-eligible profile (Req 18.1).
        await this.repo.setActive(userId, null);
      }
    }

    const paused = await this.repo.setStatus(id, userId, 'paused');
    if (!paused) throw this.notFound();
    return this.getDetail(userId, id);
  }

  /** Resume a paused profile back to active-eligible state (Req 18.3). */
  async resume(userId: string, id: string): Promise<RoleProfileDetail> {
    const ok = await this.repo.setStatus(id, userId, 'active');
    if (!ok) throw this.notFound();
    return this.getDetail(userId, id);
  }

  // -- mapping / helpers ---------------------------------------------------

  /** Give the duplicate a distinct name, avoiding collisions with existing ones. */
  private async deriveDuplicateName(userId: string, sourceName: string): Promise<string> {
    const { profiles } = await this.repo.listForOwnerWithActive(userId);
    const existing = new Set(profiles.map((p) => p.name));
    const base = `${sourceName} (Copy)`;
    if (!existing.has(base)) return base;
    let n = 2;
    while (existing.has(`${sourceName} (Copy ${n})`)) n += 1;
    return `${sourceName} (Copy ${n})`;
  }

  /** Map salary/work-rights DTO fields to nullable scalar columns (Req 15.3, 16). */
  private scalarsFromDto(
    dto: CreateRoleProfileRequest | UpdateRoleProfileRequest,
  ): Omit<ScalarFields, 'name'> {
    const scalars: Omit<ScalarFields, 'name'> = {};
    if ('salary' in dto && dto.salary !== undefined) {
      // Unspecified fields stay null (never coerced to 0, Req 15.3).
      scalars.salaryMin = dto.salary.min !== undefined ? String(dto.salary.min) : null;
      scalars.salaryMax = dto.salary.max !== undefined ? String(dto.salary.max) : null;
      scalars.salaryCurrency = dto.salary.currency ?? null;
      scalars.salaryPeriod = dto.salary.period ?? null;
    }
    if ('workRights' in dto && dto.workRights !== undefined) {
      // Stored verbatim; never derived from nationality/location (Req 16.4).
      scalars.workRights = dto.workRights;
    }
    return scalars;
  }

  /** Map DTO child collections to repository input, preserving "not provided". */
  private childrenFromDto(
    dto: CreateRoleProfileRequest | UpdateRoleProfileRequest,
  ): ChildCollections {
    const children: ChildCollections = {};
    if (dto.titles !== undefined) {
      children.titles = [
        ...dto.titles.target.map((value) => ({ kind: 'target' as const, value })),
        ...dto.titles.excluded.map((value) => ({ kind: 'excluded' as const, value })),
      ];
    }
    if (dto.skills !== undefined) {
      children.skills = [
        ...dto.skills.required.map((value) => ({ kind: 'required' as const, value })),
        ...dto.skills.preferred.map((value) => ({ kind: 'preferred' as const, value })),
      ];
    }
    if (dto.locations !== undefined) {
      children.locations = dto.locations.map((l) => ({
        value: l.value,
        isPrimary: l.isPrimary ?? false,
      }));
    }
    if (dto.preferences !== undefined) {
      children.preferences = {
        workArrangements: dto.preferences.workArrangements,
        employmentTypes: dto.preferences.employmentTypes,
        seniorityLevels: dto.preferences.seniorityLevels,
      };
    }
    return children;
  }

  private toListItem(profile: ProfileRow, activeId: string | null): RoleProfileListItem {
    return {
      id: profile.id,
      name: profile.name,
      status: profile.status === 'paused' ? 'paused' : 'active',
      isActive: profile.id === activeId,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private toDetail(hydrated: HydratedProfile, activeId: string | null): RoleProfileDetail {
    const { profile, titles, skills, locations, preferences } = hydrated;
    const detail: RoleProfileDetail = {
      ...this.toListItem(profile, activeId),
      titles: {
        target: titles.filter((t) => t.kind === 'target').map((t) => t.value),
        excluded: titles.filter((t) => t.kind === 'excluded').map((t) => t.value),
      },
      skills: {
        required: skills.filter((s) => s.kind === 'required').map((s) => s.value),
        preferred: skills.filter((s) => s.kind === 'preferred').map((s) => s.value),
      },
      locations: locations.map((l) => ({ value: l.value, isPrimary: l.isPrimary })),
      preferences: {
        workArrangements: (preferences?.workArrangements ??
          []) as RoleProfileDetail['preferences']['workArrangements'],
        employmentTypes: (preferences?.employmentTypes ??
          []) as RoleProfileDetail['preferences']['employmentTypes'],
        seniorityLevels: (preferences?.seniorityLevels ??
          []) as RoleProfileDetail['preferences']['seniorityLevels'],
      },
    };

    const salary = this.toSalary(profile);
    if (salary) detail.salary = salary;

    if (profile.workRights !== null && profile.workRights !== undefined) {
      detail.workRights = profile.workRights as RoleProfileDetail['workRights'];
    }
    return detail;
  }

  /** Build a salary object only when at least one field is set (Req 15.3). */
  private toSalary(profile: ProfileRow): RoleProfileDetail['salary'] | null {
    const hasSalary =
      profile.salaryMin !== null ||
      profile.salaryMax !== null ||
      profile.salaryCurrency !== null ||
      profile.salaryPeriod !== null;
    if (!hasSalary) return null;
    const salary: NonNullable<RoleProfileDetail['salary']> = {};
    if (profile.salaryMin !== null) salary.min = Number(profile.salaryMin);
    if (profile.salaryMax !== null) salary.max = Number(profile.salaryMax);
    if (profile.salaryCurrency !== null) salary.currency = profile.salaryCurrency;
    if (profile.salaryPeriod !== null) {
      salary.period = profile.salaryPeriod as NonNullable<RoleProfileDetail['salary']>['period'];
    }
    return salary;
  }

  private notFound(): NotFoundException {
    return new NotFoundException('Role profile not found.');
  }
}
