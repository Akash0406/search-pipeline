'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  encodeExplorerState,
  type ExplorerState,
  type OpportunityDetail,
  type OpportunityListItem,
  type OpportunityListResponse,
  type OpportunityUserStateResponse,
  type UserState,
} from '@careerstack/contracts';
import { apiFetch, ApiError } from './client';
import { resolveDisplayStatus } from '@/lib/status';

/** Page size requested per cursor fetch (server caps at 100). */
const PAGE_SIZE = 24;

/** Query keys for explorer/detail queries (all under the broad `opportunities` scope). */
export const opportunityKeys = {
  all: ['opportunities'] as const,
  /** List key derived from the encoded filter/sort state so it drives refetch. */
  list: (stateKey: string) => ['opportunities', 'list', stateKey] as const,
  detail: (id: string) => ['opportunities', 'detail', id] as const,
};

/** Build the API query object from explorer state (only defined fields). */
function toQuery(state: ExplorerState): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(state)) {
    if (value !== undefined) query[key] = String(value);
  }
  return query;
}

/**
 * Cursor-paginated explorer list (Req 40.4). The filter/sort state is encoded
 * into the query key so any change refetches; the projection never includes
 * `description` (enforced server-side, Property 21). Descriptions load lazily in
 * the detail view only.
 */
export function useOpportunities(state: ExplorerState) {
  const stateKey = encodeExplorerState(state);
  return useInfiniteQuery({
    queryKey: opportunityKeys.list(stateKey),
    queryFn: ({ pageParam }) =>
      apiFetch<OpportunityListResponse>('/opportunities', {
        query: {
          ...toQuery(state),
          limit: PAGE_SIZE,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.isUnauthorized) return false;
      return failureCount < 1;
    },
    staleTime: 30_000,
  });
}

/** Full opportunity detail including description, sources, and evidence (Req 45). */
export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: opportunityKeys.detail(id ?? '__none__'),
    queryFn: () => apiFetch<OpportunityDetail>(`/opportunities/${id}`),
    enabled: Boolean(id),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.isUnauthorized || error.status === 404)) return false;
      return failureCount < 1;
    },
    staleTime: 30_000,
  });
}

type ListCache = InfiniteData<OpportunityListResponse, string | undefined>;

/** Apply a new per-user state to a single item, recomputing its display label. */
function withUserState(item: OpportunityListItem, next: UserState): OpportunityListItem {
  return {
    ...item,
    userState: next,
    displayStatus: resolveDisplayStatus(item.status, next),
  };
}

/**
 * Optimistically patch every cached list + the detail cache to reflect a new
 * per-user state (Req 43). Returns the caches touched so a failed mutation can
 * roll back exactly what it changed.
 */
function patchCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  next: UserState,
): {
  lists: [readonly unknown[], ListCache | undefined][];
  detail: [readonly unknown[], OpportunityDetail | undefined][];
} {
  const lists = queryClient.getQueriesData<ListCache>({
    queryKey: ['opportunities', 'list'],
  });
  for (const [key, data] of lists) {
    if (!data) continue;
    queryClient.setQueryData<ListCache>(key, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: page.data.map((item) => (item.id === id ? withUserState(item, next) : item)),
      })),
    });
  }

  const detail = queryClient.getQueriesData<OpportunityDetail>({
    queryKey: opportunityKeys.detail(id),
  });
  for (const [key, data] of detail) {
    if (!data) continue;
    queryClient.setQueryData<OpportunityDetail>(key, {
      ...data,
      userState: next,
      displayStatus: resolveDisplayStatus(data.status, next),
    });
  }

  return { lists, detail };
}

interface MutationContext {
  previous: ReturnType<typeof patchCaches>;
}

/**
 * Build an optimistic save/dismiss mutation. `next` is the state applied on
 * success; `onMutate` patches caches immediately and rolls back on error so the
 * UI feels instant while staying correct (Req 43.1–43.3).
 */
function useUserStateMutation(next: UserState, request: (id: string) => Promise<OpportunityUserStateResponse>) {
  const queryClient = useQueryClient();
  return useMutation<OpportunityUserStateResponse, unknown, string, MutationContext>({
    mutationFn: request,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: opportunityKeys.all });
      const previous = patchCaches(queryClient, id, next);
      return { previous };
    },
    onError: (_err, _id, context) => {
      // Roll back exactly the caches we optimistically changed.
      for (const [key, data] of context?.previous.lists ?? []) {
        queryClient.setQueryData(key, data);
      }
      for (const [key, data] of context?.previous.detail ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (result) => {
      // Reconcile with the server's authoritative state.
      patchCaches(queryClient, result.opportunityId, result.state);
    },
  });
}

/** Save an opportunity for the current user (Req 43.1). */
export function useSaveOpportunity() {
  return useUserStateMutation('saved', (id) =>
    apiFetch<OpportunityUserStateResponse>(`/opportunities/${id}/save`, { method: 'PUT' }),
  );
}

/** Reverse a save back to `none` (Req 43.3). */
export function useUnsaveOpportunity() {
  return useUserStateMutation('none', (id) =>
    apiFetch<OpportunityUserStateResponse>(`/opportunities/${id}/save`, { method: 'DELETE' }),
  );
}

/** Dismiss an opportunity for the current user (Req 43.2). */
export function useDismissOpportunity() {
  return useUserStateMutation('dismissed', (id) =>
    apiFetch<OpportunityUserStateResponse>(`/opportunities/${id}/dismiss`, { method: 'PUT' }),
  );
}

/** Reverse a dismiss back to `none` (Req 43.3). */
export function useUndismissOpportunity() {
  return useUserStateMutation('none', (id) =>
    apiFetch<OpportunityUserStateResponse>(`/opportunities/${id}/dismiss`, { method: 'DELETE' }),
  );
}
