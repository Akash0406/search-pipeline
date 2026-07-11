'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Connection,
  ConnectionListResponse,
  ConnectorListResponse,
  CreateConnectionRequest,
  ManualUrlSubmitRequest,
  ManualUrlSubmitResponse,
  RunListResponse,
  TriggerRunResponse,
  UpdateConnectionRequest,
} from '@careerstack/contracts';
import { apiFetch, ApiError } from './client';
import { opportunityKeys } from './opportunities';
import { privacyKeys } from './privacy';

/**
 * Query keys for the sources/connections manager (Req 20–27). Kept under a
 * dedicated `connections` scope so create/pause/remove/run mutations and the
 * live-updates hook can invalidate the list in one place.
 */
export const connectionKeys = {
  all: ['connections'] as const,
  list: ['connections', 'list'] as const,
  connectors: ['connectors'] as const,
  runs: (id: string) => ['connections', 'runs', id] as const,
};

const noAuthRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof ApiError && error.isUnauthorized) return false;
  return failureCount < 1;
};

/** Available connector types to pick from in the wizard (`GET /connectors`). */
export function useConnectors() {
  return useQuery({
    queryKey: connectionKeys.connectors,
    queryFn: () => apiFetch<ConnectorListResponse>('/connectors'),
    retry: noAuthRetry,
    staleTime: 5 * 60_000,
  });
}

/** The user's configured connections with status/health/last-run (Req 24, 25). */
export function useConnectionList() {
  return useQuery({
    queryKey: connectionKeys.list,
    queryFn: () => apiFetch<ConnectionListResponse>('/connections'),
    retry: noAuthRetry,
    staleTime: 15_000,
  });
}

/** Observable runs for a connection (Req 24). Enabled only when `id` is set. */
export function useConnectionRuns(id: string | undefined) {
  return useQuery({
    queryKey: connectionKeys.runs(id ?? '__none__'),
    queryFn: () => apiFetch<RunListResponse>(`/connections/${id}/runs`),
    enabled: Boolean(id),
    retry: noAuthRetry,
    staleTime: 10_000,
  });
}

/** Invalidate every surface that reflects a connection change. */
function invalidateConnectionScope(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: connectionKeys.all });
  // The privacy/disconnect surface reads the same connections via its own key.
  void queryClient.invalidateQueries({ queryKey: privacyKeys.connections });
}

/** Create a connection bound to a connector type + config (Req 20, 21, 22). */
export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateConnectionRequest) =>
      apiFetch<Connection>('/connections', { method: 'POST', json: body }),
    onSuccess: () => invalidateConnectionScope(queryClient),
  });
}

/** Pause/resume (or reconfigure) a connection (Req 25.1). */
export function useUpdateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateConnectionRequest }) =>
      apiFetch<Connection>(`/connections/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => invalidateConnectionScope(queryClient),
  });
}

/**
 * Remove a connection (Req 25.2). Confirmation is enforced in the UI; the
 * `confirm` flag mirrors the house destructive-delete convention. Previously
 * ingested opportunities remain accessible (Req 25.3).
 */
export function useRemoveConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/connections/${id}`, { method: 'DELETE', query: { confirm: true } }),
    onSuccess: () => invalidateConnectionScope(queryClient),
  });
}

/** Enqueue an immediate run for a connection (Req 24). */
export function useTriggerRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<TriggerRunResponse>(`/connections/${id}/run`, { method: 'POST' }),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list });
      void queryClient.invalidateQueries({ queryKey: connectionKeys.runs(id) });
    },
  });
}

/** Submit a single job-posting URL for one-off fetch/parse (Req 23). */
export function useSubmitManualUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ManualUrlSubmitRequest) =>
      apiFetch<ManualUrlSubmitResponse>('/sources/manual-url', { method: 'POST', json: body }),
    onSuccess: () => {
      // A manual submission may surface a new opportunity once parsed.
      void queryClient.invalidateQueries({ queryKey: opportunityKeys.all });
    },
  });
}
