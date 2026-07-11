'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button, cn } from '@careerstack/ui';
import type { ExplorerState } from '@careerstack/contracts';
import {
  EMPLOYMENT_TYPE_LABELS,
  FRESHNESS_LABELS,
  SENIORITY_LABELS,
  SOURCE_TYPE_LABELS,
  STATE_FILTER_LABELS,
  WORK_ARRANGEMENT_LABELS,
} from '@/lib/opportunity-options';

/** Filter dimensions surfaced as chips (everything except `sort`). */
type FilterKey = Exclude<keyof ExplorerState, 'sort'>;

const FIELD_LABELS: Record<FilterKey, string> = {
  search: 'Search',
  opportunityType: 'Type',
  roleProfileId: 'Role profile',
  company: 'Company',
  location: 'Location',
  workArrangement: 'Work',
  employmentType: 'Employment',
  seniority: 'Seniority',
  source: 'Source',
  postedAfter: 'Posted after',
  postedBefore: 'Posted before',
  firstSeenAfter: 'First seen after',
  firstSeenBefore: 'First seen before',
  closesBefore: 'Closes before',
  state: 'State',
  freshness: 'Freshness',
  duplicateGroupId: 'Duplicate group',
};

const CHIP_ORDER: FilterKey[] = [
  'search',
  'opportunityType',
  'roleProfileId',
  'company',
  'location',
  'workArrangement',
  'employmentType',
  'seniority',
  'source',
  'state',
  'freshness',
  'postedAfter',
  'postedBefore',
  'firstSeenAfter',
  'firstSeenBefore',
  'closesBefore',
  'duplicateGroupId',
];

/** Present a stored value in human terms (enum → label; other → raw value). */
function displayValue(key: FilterKey, value: string): string {
  switch (key) {
    case 'workArrangement':
      return WORK_ARRANGEMENT_LABELS[value as keyof typeof WORK_ARRANGEMENT_LABELS] ?? value;
    case 'employmentType':
      return EMPLOYMENT_TYPE_LABELS[value as keyof typeof EMPLOYMENT_TYPE_LABELS] ?? value;
    case 'seniority':
      return SENIORITY_LABELS[value as keyof typeof SENIORITY_LABELS] ?? value;
    case 'source':
      return SOURCE_TYPE_LABELS[value as keyof typeof SOURCE_TYPE_LABELS] ?? value;
    case 'state':
      return STATE_FILTER_LABELS[value as keyof typeof STATE_FILTER_LABELS] ?? value;
    case 'freshness':
      return FRESHNESS_LABELS[value as keyof typeof FRESHNESS_LABELS] ?? value;
    case 'roleProfileId':
    case 'duplicateGroupId':
      // UUIDs read poorly; show a short token so the chip stays clearable.
      return `${value.slice(0, 8)}…`;
    default:
      return value;
  }
}

export interface ActiveFilterChipsProps {
  state: ExplorerState;
  onClear: (key: FilterKey) => void;
  onClearAll: () => void;
  className?: string;
}

/**
 * Active-filter chips with individual removal + reset-all (Req 41/44). Reflects
 * the current URL state; clearing a chip removes just that dimension, keeping
 * the rest of the filters and the sort intact.
 */
export function ActiveFilterChips({
  state,
  onClear,
  onClearAll,
  className,
}: ActiveFilterChipsProps) {
  const active = CHIP_ORDER.filter((key) => state[key] !== undefined && state[key] !== '');
  if (active.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {active.map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-xs font-medium"
        >
          <span className="text-muted-foreground">{FIELD_LABELS[key]}:</span>
          <span>{displayValue(key, String(state[key]))}</span>
          <button
            type="button"
            aria-label={`Clear ${FIELD_LABELS[key]} filter`}
            onClick={() => onClear(key)}
            className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  );
}
