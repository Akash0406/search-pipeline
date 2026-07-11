'use client';

import * as React from 'react';
import { Skeleton } from '@careerstack/ui';
import { ApiError } from '@/lib/api/client';
import { useRoleProfile } from '@/lib/api/hooks';
import { ErrorState } from '@/components/common/states';
import { ProfileForm } from './profile-form';

/**
 * Client loader for the edit form: fetches the profile (ownership-scoped on the
 * server, Req 19.4) and renders loading / not-found / error states before
 * handing the hydrated profile to {@link ProfileForm}.
 */
export function EditProfileClient({ id }: { id: string }) {
  const query = useRoleProfile(id);

  if (query.isLoading) {
    return (
      <div className="space-y-6" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <ErrorState
        title={notFound ? 'Profile not found' : 'Couldn’t load this profile'}
        description={
          notFound
            ? 'This role profile doesn’t exist or isn’t yours to edit.'
            : 'We hit a snag loading this profile. Please try again.'
        }
        {...(notFound ? {} : { onRetry: () => void query.refetch() })}
      />
    );
  }

  if (!query.data) return null;

  return <ProfileForm profile={query.data} />;
}
