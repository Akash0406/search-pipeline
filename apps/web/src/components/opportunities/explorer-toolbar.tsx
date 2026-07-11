'use client';

import * as React from 'react';
import { LayoutGrid, List, Table2 } from 'lucide-react';
import { Button, cn } from '@careerstack/ui';
import type { ExplorerSortKey } from '@careerstack/contracts';
import { SORT_OPTIONS } from '@/lib/opportunity-options';

export type ViewMode = 'card' | 'list' | 'table';

const VIEW_OPTIONS: ReadonlyArray<{
  value: ViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'card', label: 'Card view', icon: LayoutGrid },
  { value: 'list', label: 'List view', icon: List },
  { value: 'table', label: 'Table view', icon: Table2 },
];

const SORT_SELECT_CLASS = cn(
  'h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
);

export interface ExplorerToolbarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  sort: ExplorerSortKey | undefined;
  onSortChange: (sort: ExplorerSortKey) => void;
}

/**
 * Explorer toolbar: view-mode switcher + sort selector. Switching the view only
 * changes local presentation — filters, sort, and the loaded result set are
 * untouched (Req 40.2). The sort selector writes to URL state (Req 42/44).
 */
export function ExplorerToolbar({ view, onViewChange, sort, onSortChange }: ExplorerToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">Sort</span>
        <select
          aria-label="Sort opportunities"
          className={SORT_SELECT_CLASS}
          value={sort ?? 'newest'}
          onChange={(e) => onSortChange(e.target.value as ExplorerSortKey)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div
        role="group"
        aria-label="View mode"
        className="flex items-center gap-1 rounded-md border p-0.5"
      >
        {VIEW_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = view === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={active ? 'secondary' : 'ghost'}
              size="icon"
              className="size-7"
              aria-label={option.label}
              aria-pressed={active}
              title={option.label}
              onClick={() => onViewChange(option.value)}
            >
              <Icon className="size-4" aria-hidden />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
