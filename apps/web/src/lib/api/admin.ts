'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  AdminRunsResponse,
  ConnectorHealthResponse,
  ParserFailuresResponse,
  ReviewQueueResponse,
} from '@careerstack/contracts';
import { apiFetch, ApiError } from './client';

/** Query keys for the admin connector-health surface (Req 47, 48). */
export const adminKeys = {
  all: ['admin'] as const,
  connectorHealth: ['admin', 'connector-health'] as const,
  runs: ['admin', 'runs'] as const,
  parserFailures: ['admin', 'parser-failures'] as const,
  reviewQueue: ['admin', 'review-queue'] as const,
};

/**
 * Shared retry policy for admin reads: never retry an auth (401) or
 * authorization (403) failure — those drive the access-denied state rather than
 * a spinner loop (Req 47.3).
 */
function adminRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.isUnauthorized || error.status === 403)) return false;
  return failureCount < 1;
}

/** Per-connection connector health (Req 47.1). */
export function useConnectorHealth() {
  return useQuery({
    queryKey: adminKeys.connectorHealth,
    queryFn: () => apiFetch<ConnectorHealthResponse>('/admin/connector-health'),
    retry: adminRetry,
    staleTime: 15_000,
  });
}

/** Recent connector runs with counts + failure reasons (Req 47.2). */
export function useAdminRuns(limit = 25) {
  return useQuery({
    queryKey: [...adminKeys.runs, limit] as const,
    queryFn: () => apiFetch<AdminRunsResponse>('/admin/runs', { query: { limit } }),
    retry: adminRetry,
    staleTime: 15_000,
  });
}

/** Parser/validation failures with their reasons (Req 48.1). */
export function useParserFailures(limit = 25) {
  return useQuery({
    queryKey: [...adminKeys.parserFailures, limit] as const,
    queryFn: () => apiFetch<ParserFailuresResponse>('/admin/parser-failures', { query: { limit } }),
    retry: adminRetry,
    staleTime: 15_000,
  });
}

/** Open opportunity/duplicate review-queue items (Req 48.2). */
export function useReviewQueue(limit = 25) {
  return useQuery({
    queryKey: [...adminKeys.reviewQueue, limit] as const,
    queryFn: () => apiFetch<ReviewQueueResponse>('/admin/review-queue', { query: { limit } }),
    retry: adminRetry,
    staleTime: 15_000,
  });
}
