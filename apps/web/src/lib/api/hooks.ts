'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  MeResponse,
  PreferencesResponse,
  RoleProfileListResponse,
  Theme,
  UpdatePreferencesRequest,
} from '@careerstack/contracts';
import { apiFetch, ApiError } from './client';

/** Query keys used across the app. */
export const queryKeys = {
  me: ['me'] as const,
  roleProfiles: ['role-profiles'] as const,
};

/** Current authenticated user (drives active-profile indicator, role gating). */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<MeResponse>('/me'),
    retry: (failureCount, error) => {
      // Never retry an auth failure; the shell will redirect to /signin.
      if (error instanceof ApiError && error.isUnauthorized) return false;
      return failureCount < 1;
    },
    staleTime: 60_000,
  });
}

/** The user's role profiles (for the active-profile switcher). */
export function useRoleProfiles() {
  return useQuery({
    queryKey: queryKeys.roleProfiles,
    queryFn: () => apiFetch<RoleProfileListResponse>('/role-profiles'),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.isUnauthorized) return false;
      return failureCount < 1;
    },
    staleTime: 60_000,
  });
}

/** Persist theme/timezone preference (Req 3.5). */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePreferencesRequest) =>
      apiFetch<PreferencesResponse>('/me/preferences', { method: 'PATCH', json: body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

/** Activate a role profile, then refresh `me` + the profile list. */
export function useActivateRoleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<unknown>(`/role-profiles/${id}/activate`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.roleProfiles });
    },
  });
}

/** Best-effort persist of the theme; ignores failures (e.g., signed-out). */
export function persistTheme(theme: Theme): void {
  void apiFetch<PreferencesResponse>('/me/preferences', {
    method: 'PATCH',
    json: { theme },
  }).catch(() => {
    /* Non-fatal: local next-themes state already applied. */
  });
}
