'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConnectionListResponse,
  DeleteAccountResponse,
  DeleteDataCategory,
  DeleteDataResponse,
  DisconnectResponse,
  ExportRequestResponse,
  ExportStatusResponse,
  RetentionPolicyResponse,
  RevokeSessionResponse,
  SessionListResponse,
} from '@careerstack/contracts';
import { apiFetch, ApiError } from './client';

/** Query keys for the privacy + settings surface (Req 49–53, 6). */
export const privacyKeys = {
  all: ['privacy'] as const,
  export: (id: string) => ['privacy', 'export', id] as const,
  connections: ['privacy', 'connections'] as const,
  retention: ['privacy', 'retention'] as const,
  sessions: ['sessions'] as const,
};

const noAuthRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof ApiError && error.isUnauthorized) return false;
  return failureCount < 1;
};

/* ------------------------------------------------------------------ *
 * Data export (Req 49, 56)
 * ------------------------------------------------------------------ */

/** Trigger a new async data export (Req 49.1). */
export function useRequestExport() {
  return useMutation({
    mutationFn: () => apiFetch<ExportRequestResponse>('/privacy/export', { method: 'POST' }),
  });
}

/**
 * Poll an export's status (Req 49.3, 56). While the export is `pending` or
 * `processing`, the query self-refreshes on an interval so the UI reflects
 * completion without a manual reload; SSE invalidation also nudges it live.
 */
export function useExportStatus(exportId: string | undefined) {
  return useQuery({
    queryKey: privacyKeys.export(exportId ?? '__none__'),
    queryFn: () => apiFetch<ExportStatusResponse>(`/privacy/export/${exportId}`),
    enabled: Boolean(exportId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.isUnauthorized || error.status === 404)) return false;
      return failureCount < 1;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'processing' ? 3_000 : false;
    },
    staleTime: 0,
  });
}

/* ------------------------------------------------------------------ *
 * Connections / disconnect (Req 51)
 * ------------------------------------------------------------------ */

/** List the user's connected sources for the disconnect flow (Req 51). */
export function useConnections() {
  return useQuery({
    queryKey: privacyKeys.connections,
    queryFn: () => apiFetch<ConnectionListResponse>('/connections'),
    retry: noAuthRetry,
    staleTime: 30_000,
  });
}

/** Disconnect an OAuth source; opportunities stay accessible (Req 51.1–51.3). */
export function useDisconnectConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DisconnectResponse>(`/connections/${id}/disconnect`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: privacyKeys.connections });
    },
  });
}

/* ------------------------------------------------------------------ *
 * Deletion (Req 50, 7)
 * ------------------------------------------------------------------ */

/** Delete specific categories of the user's data (confirmation-gated, Req 50.2). */
export function useDeleteData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categories: DeleteDataCategory[]) =>
      apiFetch<DeleteDataResponse>('/privacy/delete-data', {
        method: 'POST',
        json: { confirm: true, categories },
      }),
    onSuccess: () => {
      // The deleted categories may span profiles, states, connections, sessions.
      void queryClient.invalidateQueries();
    },
  });
}

/** Permanently delete the account (high-friction confirmation, Req 7, 50.1). */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: () =>
      apiFetch<DeleteAccountResponse>('/privacy/delete-account', {
        method: 'POST',
        json: { confirm: true },
      }),
  });
}

/* ------------------------------------------------------------------ *
 * Retention policy (Req 53.1)
 * ------------------------------------------------------------------ */

/** Read the configurable raw-source retention policy (Req 53.1). */
export function useRetentionPolicy() {
  return useQuery({
    queryKey: privacyKeys.retention,
    queryFn: () => apiFetch<RetentionPolicyResponse>('/privacy/retention'),
    retry: noAuthRetry,
    staleTime: 5 * 60_000,
  });
}

/* ------------------------------------------------------------------ *
 * Sessions (Req 6) — belongs to settings; surfaced here for reuse.
 * ------------------------------------------------------------------ */

/** List the user's active sessions (Req 6.1). */
export function useSessions() {
  return useQuery({
    queryKey: privacyKeys.sessions,
    queryFn: () => apiFetch<SessionListResponse>('/me/sessions'),
    retry: noAuthRetry,
    staleTime: 30_000,
  });
}

/** Revoke a single session by id (Req 6.2). */
export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RevokeSessionResponse>(`/me/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: privacyKeys.sessions });
    },
  });
}

/** Revoke all other sessions, keeping the current one (Req 6.3). */
export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<RevokeSessionResponse>('/me/sessions', {
        method: 'DELETE',
        query: { others: true },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: privacyKeys.sessions });
    },
  });
}
