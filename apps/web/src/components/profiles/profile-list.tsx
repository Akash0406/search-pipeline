'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, UserCircle } from 'lucide-react';
import type { RoleProfileListItem } from '@careerstack/contracts';
import { Button, Skeleton, toast } from '@careerstack/ui';
import { ApiError } from '@/lib/api/client';
import {
  useActivateRoleProfile,
  useDeleteRoleProfile,
  useDuplicateRoleProfile,
  useMe,
  usePauseRoleProfile,
  useResumeRoleProfile,
  useRoleProfiles,
} from '@/lib/api/hooks';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ProfileCard } from './profile-card';
import { DeleteProfileDialog } from './delete-profile-dialog';
import { SelectActiveProfileDialog } from './select-active-dialog';

function ProfilesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Client-side role-profile list with full empty / loading / error states
 * (Design §8) and the create/activate/duplicate/pause/resume/delete flows
 * (Req 10, 17–19). Orchestrates the two prompts that keep the one-active
 * invariant intact:
 *  - pausing the active profile asks for a replacement first (Req 18.2);
 *  - deleting the active profile lets the user confirm/adjust the new active
 *    the API selected (Req 19.3).
 */
export function ProfileList() {
  const me = useMe();
  const query = useRoleProfiles();

  const activate = useActivateRoleProfile();
  const duplicate = useDuplicateRoleProfile();
  const resume = useResumeRoleProfile();
  const pause = usePauseRoleProfile();
  const remove = useDeleteRoleProfile();

  const [deleteTarget, setDeleteTarget] = React.useState<RoleProfileListItem | null>(null);
  const [pauseTarget, setPauseTarget] = React.useState<RoleProfileListItem | null>(null);
  const [reselectActive, setReselectActive] = React.useState<RoleProfileListItem[] | null>(null);

  const profiles = query.data?.profiles ?? [];
  const timezone = me.data?.timezone;

  const busy =
    activate.isPending ||
    duplicate.isPending ||
    resume.isPending ||
    pause.isPending ||
    remove.isPending;

  const reportError = (err: unknown, fallback: string) => {
    toast.error(err instanceof ApiError ? err.message : fallback);
  };

  const onActivate = (profile: RoleProfileListItem) => {
    activate.mutate(profile.id, {
      onSuccess: () => toast.success(`“${profile.name}” is now your active profile`),
      onError: (err) => reportError(err, 'Couldn’t switch profiles. Please try again.'),
    });
  };

  const onResume = (profile: RoleProfileListItem) => {
    resume.mutate(profile.id, {
      onSuccess: () => toast.success(`Resumed “${profile.name}”`),
      onError: (err) => reportError(err, 'Couldn’t resume the profile. Please try again.'),
    });
  };

  const onDuplicate = (profile: RoleProfileListItem) => {
    duplicate.mutate(profile.id, {
      onSuccess: (data) => toast.success(`Created a copy: “${data.name}”`),
      onError: (err) => reportError(err, 'Couldn’t duplicate the profile. Please try again.'),
    });
  };

  const onPause = (profile: RoleProfileListItem) => {
    const others = profiles.filter((p) => p.id !== profile.id);
    // Pausing the active profile requires selecting a replacement first (Req 18.2).
    if (profile.isActive && others.length > 0) {
      setPauseTarget(profile);
      return;
    }
    pause.mutate(
      { id: profile.id },
      {
        onSuccess: () => toast.success(`Paused “${profile.name}”`),
        onError: (err) => reportError(err, 'Couldn’t pause the profile. Please try again.'),
      },
    );
  };

  const confirmPauseWithReplacement = (replacementId: string) => {
    if (!pauseTarget) return;
    pause.mutate(
      { id: pauseTarget.id, activateProfileId: replacementId },
      {
        onSuccess: () => {
          toast.success(`Paused “${pauseTarget.name}” and switched active profile`);
          setPauseTarget(null);
        },
        onError: (err) => reportError(err, 'Couldn’t pause the profile. Please try again.'),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    remove.mutate(target.id, {
      onSuccess: (result) => {
        setDeleteTarget(null);
        toast.success(`Deleted “${target.name}”`);
        // The API auto-selected a new active; let the user pick a different one.
        if (result.requiresActiveSelection) {
          const remaining = profiles.filter((p) => p.id !== target.id);
          if (remaining.length > 0) setReselectActive(remaining);
        }
      },
      onError: (err) => reportError(err, 'Couldn’t delete the profile. Please try again.'),
    });
  };

  const confirmReselect = (id: string) => {
    activate.mutate(id, {
      onSuccess: () => {
        const chosen = reselectActive?.find((p) => p.id === id);
        toast.success(`“${chosen?.name ?? 'Profile'}” is now your active profile`);
        setReselectActive(null);
      },
      onError: (err) => reportError(err, 'Couldn’t switch profiles. Please try again.'),
    });
  };

  if (query.isLoading) return <ProfilesSkeleton />;

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn’t load your profiles"
        description="We hit a snag loading your role profiles. Please try again."
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (profiles.length === 0) {
    return (
      <EmptyState
        icon={UserCircle}
        title="No role profiles yet"
        description="Create your first role profile to tell us the roles you want. Your first profile becomes active automatically."
        action={
          <Button asChild>
            <Link href="/app/profiles/new">
              <Plus className="size-4" aria-hidden />
              Create a role profile
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            busy={busy}
            {...(timezone ? { timezone } : {})}
            onActivate={onActivate}
            onResume={onResume}
            onDuplicate={onDuplicate}
            onPause={onPause}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>

      <DeleteProfileDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        profileName={deleteTarget?.name ?? ''}
        isActive={deleteTarget?.isActive ?? false}
        onConfirm={confirmDelete}
        pending={remove.isPending}
      />

      <SelectActiveProfileDialog
        open={pauseTarget !== null}
        onOpenChange={(open) => !open && setPauseTarget(null)}
        title="Choose a new active profile"
        description={`Pausing “${pauseTarget?.name ?? ''}” means it can’t be your active profile. Pick another to activate first.`}
        candidates={pauseTarget ? profiles.filter((p) => p.id !== pauseTarget.id) : []}
        onSelect={confirmPauseWithReplacement}
        pending={pause.isPending}
        confirmLabel="Activate & pause"
      />

      <SelectActiveProfileDialog
        open={reselectActive !== null}
        onOpenChange={(open) => !open && setReselectActive(null)}
        title="Pick your active profile"
        description="You deleted your active profile. We selected one for you — choose a different one if you’d prefer."
        candidates={reselectActive ?? []}
        onSelect={confirmReselect}
        pending={activate.isPending}
      />
    </>
  );
}
