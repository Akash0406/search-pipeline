/**
 * Ownership-scoped data access for role profiles (Capability C, Req 10–19).
 *
 * Extends {@link OwnershipScopedRepository} so every profile read/write is
 * unconditionally constrained by `WHERE role_profiles.user_id = :ownerId`
 * (PRIV-006 / Req 10.5, 19.4): a foreign or missing id yields not-found / no-op
 * rather than another user's rows. Child tables (titles/skills/locations/
 * preferences) are only reachable through a parent profile whose ownership was
 * already verified, and compound writes run in a single transaction with
 * replace-on-update semantics for the child collections.
 *
 * The "exactly one active profile" invariant (Req 10.2) is stored in
 * `user_preferences.active_role_profile_id` — the single source of truth — and
 * mutated here alongside profile lifecycle changes so it stays consistent.
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import type { Database } from '@careerstack/database';
import {
  OwnershipScopedRepository,
  roleProfileLocations,
  roleProfilePreferences,
  roleProfileSkills,
  roleProfileTitles,
  roleProfiles,
  userPreferences,
} from '@careerstack/database';
import { DB } from '../common/di-tokens.js';

/** A profile row joined with its owning user's active-profile pointer. */
export interface ProfileRow {
  id: string;
  name: string;
  status: string;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  workRights: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/** Fully-hydrated profile: the profile row plus its child collections. */
export interface HydratedProfile {
  profile: ProfileRow;
  titles: { kind: string; value: string }[];
  skills: { kind: string; value: string }[];
  locations: { value: string; isPrimary: boolean }[];
  preferences: {
    workArrangements: string[] | null;
    employmentTypes: string[] | null;
    seniorityLevels: string[] | null;
  } | null;
}

/** Normalized child collections used by create/update writes. */
export interface ChildCollections {
  titles?: { kind: 'target' | 'excluded'; value: string }[];
  skills?: { kind: 'required' | 'preferred'; value: string }[];
  locations?: { value: string; isPrimary: boolean }[];
  preferences?: {
    workArrangements: string[];
    employmentTypes: string[];
    seniorityLevels: string[];
  };
}

/** Scalar profile columns written on create/update. */
export interface ScalarFields {
  name?: string;
  salaryMin?: string | null;
  salaryMax?: string | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
  workRights?: unknown;
}

@Injectable()
export class RoleProfileRepository extends OwnershipScopedRepository<typeof roleProfiles> {
  constructor(@Inject(DB) db: Database) {
    super(db, {
      table: roleProfiles,
      idColumn: roleProfiles.id,
      ownerColumn: roleProfiles.userId,
    });
  }

  /** How many profiles the user owns (drives first-profile auto-activate). */
  async countForOwner(ownerId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(roleProfiles)
      .where(eq(roleProfiles.userId, ownerId));
    return Number(row?.value ?? 0);
  }

  /** The user's active profile id (single source of truth, Req 10.2). */
  async getActiveProfileId(ownerId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ activeRoleProfileId: userPreferences.activeRoleProfileId })
      .from(userPreferences)
      .where(eq(userPreferences.userId, ownerId))
      .limit(1);
    return row?.activeRoleProfileId ?? null;
  }

  /** List the user's profiles (newest first) with the active pointer. */
  async listForOwnerWithActive(
    ownerId: string,
  ): Promise<{ profiles: ProfileRow[]; activeId: string | null }> {
    const profiles = (await this.db
      .select()
      .from(roleProfiles)
      .where(eq(roleProfiles.userId, ownerId))) as ProfileRow[];
    profiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const activeId = await this.getActiveProfileId(ownerId);
    return { profiles, activeId };
  }

  /** Fetch a single owned profile with all children, or null (deny/missing). */
  async findHydratedForOwner(
    id: string,
    ownerId: string,
  ): Promise<{ hydrated: HydratedProfile; activeId: string | null } | null> {
    const profile = (await this.findByIdForOwner(id, ownerId)) as ProfileRow | null;
    if (!profile) return null;

    const [titles, skills, locations, prefsRows, activeId] = await Promise.all([
      this.db
        .select({ kind: roleProfileTitles.kind, value: roleProfileTitles.value })
        .from(roleProfileTitles)
        .where(eq(roleProfileTitles.roleProfileId, id)),
      this.db
        .select({ kind: roleProfileSkills.kind, value: roleProfileSkills.value })
        .from(roleProfileSkills)
        .where(eq(roleProfileSkills.roleProfileId, id)),
      this.db
        .select({ value: roleProfileLocations.value, isPrimary: roleProfileLocations.isPrimary })
        .from(roleProfileLocations)
        .where(eq(roleProfileLocations.roleProfileId, id)),
      this.db
        .select({
          workArrangements: roleProfilePreferences.workArrangements,
          employmentTypes: roleProfilePreferences.employmentTypes,
          seniorityLevels: roleProfilePreferences.seniorityLevels,
        })
        .from(roleProfilePreferences)
        .where(eq(roleProfilePreferences.roleProfileId, id))
        .limit(1),
      this.getActiveProfileId(ownerId),
    ]);

    return {
      hydrated: {
        profile,
        titles,
        skills,
        locations,
        preferences: prefsRows[0] ?? null,
      },
      activeId,
    };
  }

  /**
   * Create a profile with its children in one transaction. When the user has no
   * existing profiles, the new profile becomes the Active_Role_Profile
   * (Req 10.4). Returns the new profile id.
   */
  async createWithChildren(
    ownerId: string,
    scalars: ScalarFields & { name: string },
    children: ChildCollections,
  ): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ value: count() })
        .from(roleProfiles)
        .where(eq(roleProfiles.userId, ownerId));
      const isFirstProfile = Number(existing?.value ?? 0) === 0;

      const [created] = await tx
        .insert(roleProfiles)
        .values({
          userId: ownerId,
          name: scalars.name,
          status: 'active',
          salaryMin: scalars.salaryMin ?? null,
          salaryMax: scalars.salaryMax ?? null,
          salaryCurrency: scalars.salaryCurrency ?? null,
          salaryPeriod: scalars.salaryPeriod ?? null,
          workRights: scalars.workRights ?? null,
        })
        .returning({ id: roleProfiles.id });
      const profileId = (created as { id: string }).id;

      await this.writeChildren(tx, profileId, children, { insertPreferences: true });

      if (isFirstProfile) {
        await this.upsertActive(tx, ownerId, profileId);
      }
      return profileId;
    });
  }

  /**
   * Update scalar fields and, for any provided child collection, replace it
   * wholesale (replace-on-update). Untouched collections are preserved. Returns
   * false when the profile is not owned by the user (deny).
   */
  async updateWithChildren(
    id: string,
    ownerId: string,
    scalars: ScalarFields,
    children: ChildCollections,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: roleProfiles.id })
        .from(roleProfiles)
        .where(and(eq(roleProfiles.id, id), eq(roleProfiles.userId, ownerId)))
        .limit(1);
      if (!owned) return false;

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (scalars.name !== undefined) patch.name = scalars.name;
      if (scalars.salaryMin !== undefined) patch.salaryMin = scalars.salaryMin;
      if (scalars.salaryMax !== undefined) patch.salaryMax = scalars.salaryMax;
      if (scalars.salaryCurrency !== undefined) patch.salaryCurrency = scalars.salaryCurrency;
      if (scalars.salaryPeriod !== undefined) patch.salaryPeriod = scalars.salaryPeriod;
      if (scalars.workRights !== undefined) patch.workRights = scalars.workRights;
      await tx.update(roleProfiles).set(patch).where(eq(roleProfiles.id, id));

      await this.writeChildren(tx, id, children, { insertPreferences: false });
      return true;
    });
  }

  /**
   * Delete an owned profile (children cascade). The DB clears the active pointer
   * automatically (`on delete set null`). Returns true when a row was deleted.
   */
  async deleteOwned(id: string, ownerId: string): Promise<boolean> {
    return this.deleteForOwner(id, ownerId);
  }

  /** Set the active profile to a specific id (or clear it), for the owner. */
  async setActive(ownerId: string, profileId: string | null): Promise<void> {
    await this.upsertActive(this.db, ownerId, profileId);
  }

  /**
   * Set a profile's lifecycle status ('active' | 'paused') if owned. Returns
   * false when the profile is not owned (deny).
   */
  async setStatus(
    id: string,
    ownerId: string,
    status: 'active' | 'paused',
  ): Promise<boolean> {
    const rows = await this.db
      .update(roleProfiles)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(roleProfiles.id, id), eq(roleProfiles.userId, ownerId)))
      .returning({ id: roleProfiles.id });
    return rows.length > 0;
  }

  /**
   * Activate a profile: mark it active-eligible and set it as the owner's active
   * profile in one transaction (Req 10.3 deactivates the previous by replacing
   * the single pointer). Returns false when not owned.
   */
  async activateOwned(id: string, ownerId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(roleProfiles)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(eq(roleProfiles.id, id), eq(roleProfiles.userId, ownerId)))
        .returning({ id: roleProfiles.id });
      if (rows.length === 0) return false;
      await this.upsertActive(tx, ownerId, id);
      return true;
    });
  }

  // -- internals -----------------------------------------------------------

  /** Upsert the owner's active-profile pointer (single source of truth). */
  private async upsertActive(
    tx: Database,
    ownerId: string,
    profileId: string | null,
  ): Promise<void> {
    await tx
      .insert(userPreferences)
      .values({ userId: ownerId, activeRoleProfileId: profileId })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { activeRoleProfileId: profileId, updatedAt: new Date() },
      });
  }

  /**
   * Replace-on-update child writes. Only provided collections are touched; each
   * provided collection is fully replaced. Preferences are upserted (singleton).
   */
  private async writeChildren(
    tx: Database,
    profileId: string,
    children: ChildCollections,
    opts: { insertPreferences: boolean },
  ): Promise<void> {
    if (children.titles !== undefined) {
      await tx.delete(roleProfileTitles).where(eq(roleProfileTitles.roleProfileId, profileId));
      if (children.titles.length > 0) {
        await tx.insert(roleProfileTitles).values(
          children.titles.map((t) => ({ roleProfileId: profileId, kind: t.kind, value: t.value })),
        );
      }
    }

    if (children.skills !== undefined) {
      await tx.delete(roleProfileSkills).where(eq(roleProfileSkills.roleProfileId, profileId));
      if (children.skills.length > 0) {
        await tx.insert(roleProfileSkills).values(
          children.skills.map((s) => ({ roleProfileId: profileId, kind: s.kind, value: s.value })),
        );
      }
    }

    if (children.locations !== undefined) {
      await tx
        .delete(roleProfileLocations)
        .where(eq(roleProfileLocations.roleProfileId, profileId));
      if (children.locations.length > 0) {
        await tx.insert(roleProfileLocations).values(
          children.locations.map((l) => ({
            roleProfileId: profileId,
            value: l.value,
            isPrimary: l.isPrimary,
          })),
        );
      }
    }

    if (children.preferences !== undefined || opts.insertPreferences) {
      const prefs = children.preferences ?? {
        workArrangements: [],
        employmentTypes: [],
        seniorityLevels: [],
      };
      await tx
        .insert(roleProfilePreferences)
        .values({
          roleProfileId: profileId,
          workArrangements: prefs.workArrangements,
          employmentTypes: prefs.employmentTypes,
          seniorityLevels: prefs.seniorityLevels,
        })
        .onConflictDoUpdate({
          target: roleProfilePreferences.roleProfileId,
          set: {
            workArrangements: prefs.workArrangements,
            employmentTypes: prefs.employmentTypes,
            seniorityLevels: prefs.seniorityLevels,
          },
        });
    }
  }
}
