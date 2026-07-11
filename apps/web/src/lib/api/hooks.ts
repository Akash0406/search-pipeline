'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRoleProfileRequest,
  MeResponse,
  PreferencesResponse,
  RoleProfileDetail,
  RoleProfileListResponse,
  Theme,
  UpdatePreferencesRequest,
  UpdateRoleProfileRequest,
} from '@careerstack/contracts';
import { apiFetch, ApiError } from './client';

/** Query keys used across the app. */
export const queryKeys = {
  me: ['me'] as const,
  roleProfiles: ['role-profiles'] as const,
  roleProfile: (id: string) => ['role-profiles', id] as const,
  /** Broad key covering explorer/detail queries invalidated on profile switch. */
  opportunities: ['opportunities'] as const,
};

/**
 * Result of `DELETE /role-profiles/{id}` (mirrors the API's
 * `DeleteRoleProfileResult`). Not exported from contracts, so declared here to
 * keep the mutation typed and drive the "select a new active profile" prompt
 * (Req 19.3).
 */
export interface DeleteRoleProfileResult {
  status: 'deleted';
  deletedId: string;
  newActiveProfileId: string | null;
  requiresActiveSelection: boolean;
}

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

/** The user's role profiles (for the active-profile switcher + list page). */
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

/** One role profile in full (drives the edit form). */
export function useRoleProfile(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roleProfile(id ?? '__none__'),
    queryFn: () => apiFetch<RoleProfileDetail>(`/role-profiles/${id}`),
    enabled: Boolean(id),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.isUnauthorized || error.status === 404)) return false;
      return failureCount < 1;
    },
    staleTime: 30_000,
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

/**
 * Invalidate every query whose result depends on the active profile. Called
 * after any operation that can change the active pointer (activate, delete,
 * pause) so the shell indicator and the explorer stay in sync app-wide.
 */
function invalidateActiveProfileScope(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.me });
  void queryClient.invalidateQueries({ queryKey: queryKeys.roleProfiles });
  // Discovery/explorer results are scoped by the active profile (Req 3.4).
  void queryClient.invalidateQueries({ queryKey: queryKeys.opportunities });
}

/** Activate a role profile, then refresh the active-profile scope (Req 10.3, 3.4). */
export function useActivateRoleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RoleProfileDetail>(`/role-profiles/${id}/activate`, { method: 'POST' }),
    onSuccess: () => invalidateActiveProfileScope(queryClient),
  });
}

/** Create a role profile (Req 10.1; first one auto-activates, Req 10.4). */
export function useCreateRoleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoleProfileRequest) =>
      apiFetch<RoleProfileDetail>('/role-profiles', { method: 'POST', json: body }),
    onSuccess: () => invalidateActiveProfileScope(queryClient),
  });
}

/** Update a role profile (Req 19.1). */
export function useUpdateRoleProfile(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateRoleProfileRequest) =>
      apiFetch<RoleProfileDetail>(`/role-profiles/${id}`, { method: 'PATCH', json: body }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.roleProfile(id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.roleProfiles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

/**
 * Delete a role profile (confirmation enforced in the UI + API, Req 19.2). The
 * result flags when the user should pick a new active profile (Req 19.3).
 */
export function useDeleteRoleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DeleteRoleProfileResult>(`/role-profiles/${id}`, {
        method: 'DELETE',
        query: { confirm: 'true' },
      }),
    onSuccess: () => invalidateActiveProfileScope(queryClient),
  });
}

/** Duplicate a role profile; the active pointer is unchanged (Req 17). */
export function useDuplicateRoleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RoleProfileDetail>(`/role-profiles/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roleProfiles });
    },
  });
}

/**
 * Pause a role profile (Req 18). Pausing the active profile requires selecting
 * a replacement first; pass `activateProfileId` to activate one before pausing
 * (the API returns 409 otherwise).
 */
export function usePauseRoleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activateProfileId }: { id: string; activateProfileId?: string }) =>
      apiFetch<RoleProfileDetail>(`/role-profiles/${id}/pause`, {
        method: 'POST',
        json: activateProfileId ? { activateProfileId } : {},
      }),
    onSuccess: () => invalidateActiveProfileScope(queryClient),
  });
}

/** Resume a paused role profile to active-eligible state (Req 18.3). */
export function useResumeRoleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RoleProfileDetail>(`/role-profiles/${id}/resume`, { method: 'POST' }),
    onSuccess: () => {
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
