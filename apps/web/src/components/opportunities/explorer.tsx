'use client';

import * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@careerstack/ui';
import type { ExplorerSortKey, ExplorerState } from '@careerstack/contracts';
import { ApiError } from '@/lib/api/client';
import { useOpportunities } from '@/lib/api/opportunities';
import { ErrorState } from '@/components/common/states';
import { useExplorerState } from './use-explorer-state';
import { FilterPanel } from './filter-panel';
import { ActiveFilterChips } from './active-filter-chips';
import { ExplorerToolbar, type ViewMode } from './explorer-toolbar';
import { OpportunityCard } from './opportunity-card';
import { OpportunityRow } from './opportunity-row';
import { OpportunitiesTable } from './opportunities-table';
import { FilteredNoResultsState, FirstUseEmptyState, ResultsSkeleton } from './result-states';

const VIEW_STORAGE_KEY = 'careerstack:explorer-view';

/** True when any filter (not just sort) is active. */
function hasActiveFilters(state: ExplorerState): boolean {
  return Object.entries(state).some(([key, value]) => key !== 'sort' && value !== undefined);
}

/**
 * The opportunity explorer (Req 40–44). The URL query string is the single
 * source of truth for filters + sort (via {@link useExplorerState}); the view
 * mode is local presentation only, so switching views preserves filters, sort,
 * and the already-loaded result set (Req 40.2). Results are cursor-paginated
 * with a load-more control (Req 40.4) and never carry descriptions (Req 40.3).
 */
export function OpportunityExplorer() {
  const { state, setField, clearAll } = useExplorerState();
  const [view, setView] = React.useState<ViewMode>('card');
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Restore the last-used view mode (presentation preference, not shareable).
  React.useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'card' || stored === 'list' || stored === 'table') setView(stored);
  }, []);

  const onViewChange = React.useCallback((next: ViewMode) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }, []);

  const query = useOpportunities(state);
  const items = React.useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );
  const filtersActive = hasActiveFilters(state);

  const onSortChange = (sort: ExplorerSortKey) => setField('sort', sort);

  const results = () => {
    if (query.isLoading) return <ResultsSkeleton view={view} />;

    if (query.isError) {
      const unauthorized = query.error instanceof ApiError && query.error.isUnauthorized;
      return (
        <ErrorState
          title="Couldn’t load opportunities"
          description={
            unauthorized
              ? 'Your session may have expired. Try refreshing the page.'
              : 'We hit a snag loading opportunities. Please try again.'
          }
          onRetry={() => void query.refetch()}
        />
      );
    }

    if (items.length === 0) {
      if (filtersActive) return <FilteredNoResultsState onClearAll={clearAll} />;
      return <FirstUseEmptyState />;
    }

    return (
      <>
        {view === 'card' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <OpportunityCard key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {view === 'list' ? (
          <div className="divide-y rounded-xl border">
            {items.map((item) => (
              <OpportunityRow key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {view === 'table' ? <OpportunitiesTable items={items} /> : null}

        <div className="flex flex-col items-center gap-2 pt-6">
          {query.hasNextPage ? (
            <Button
              variant="outline"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {items.length === 1 ? '1 opportunity' : `${items.length} opportunities`} · end of
              results
            </p>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Desktop sticky filter sidebar. */}
      <aside className="hidden w-64 shrink-0 lg:block lg:sticky lg:top-20" aria-label="Filters">
        <FilterPanel state={state} setField={setField} />
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Mobile filter drawer trigger. */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Narrow opportunities by any dimension.</SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <FilterPanel state={state} setField={setField} />
                </div>
              </SheetContent>
            </Sheet>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {items.length > 0
                ? `${items.length}${query.hasNextPage ? '+' : ''} shown`
                : 'Opportunities'}
            </span>
          </div>

          <ExplorerToolbar
            view={view}
            onViewChange={onViewChange}
            sort={state.sort}
            onSortChange={onSortChange}
          />
        </div>

        <ActiveFilterChips
          state={state}
          onClear={(key) => setField(key, undefined)}
          onClearAll={clearAll}
        />

        {results()}
      </div>
    </div>
  );
}
