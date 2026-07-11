'use client';

import * as React from 'react';
import type { ExplorerState } from '@careerstack/contracts';
import { Separator } from '@careerstack/ui';
import { useRoleProfiles } from '@/lib/api/hooks';
import {
  EMPLOYMENT_TYPE_OPTIONS,
  FRESHNESS_OPTIONS,
  SENIORITY_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  STATE_FILTER_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
} from '@/lib/opportunity-options';
import { FilterSelect, FilterTextInput } from './filter-controls';

export interface FilterPanelProps {
  state: ExplorerState;
  setField: <K extends keyof ExplorerState>(key: K, value: ExplorerState[K] | undefined) => void;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/**
 * The filter form (Req 41). Exposes every filter dimension from the contracts
 * `ExplorerState`; each control writes straight back to the URL via `setField`,
 * which re-runs the query (Req 41.5). All controls are native/labelled and thus
 * keyboard accessible (Req 57). Rendered in a sticky sidebar on desktop and a
 * drawer on mobile by the parent explorer.
 */
export function FilterPanel({ state, setField }: FilterPanelProps) {
  const roleProfiles = useRoleProfiles();
  const roleProfileOptions = (roleProfiles.data?.profiles ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      <FilterGroup title="Keywords">
        <FilterTextInput
          id="filter-search"
          label="Search"
          value={state.search}
          placeholder="Title, company, keywords"
          onCommit={(v) => setField('search', v)}
        />
        <FilterTextInput
          id="filter-type"
          label="Opportunity type"
          value={state.opportunityType}
          placeholder="e.g. Engineering"
          onCommit={(v) => setField('opportunityType', v)}
        />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Role and company">
        {roleProfileOptions.length > 0 ? (
          <FilterSelect
            id="filter-role-profile"
            label="Role profile"
            value={state.roleProfileId}
            options={roleProfileOptions}
            placeholder="Any profile"
            onChange={(v) => setField('roleProfileId', v)}
          />
        ) : null}
        <FilterTextInput
          id="filter-company"
          label="Company"
          value={state.company}
          placeholder="e.g. Acme"
          onCommit={(v) => setField('company', v)}
        />
        <FilterTextInput
          id="filter-location"
          label="Location"
          value={state.location}
          placeholder="e.g. Berlin"
          onCommit={(v) => setField('location', v)}
        />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Role details">
        <FilterSelect
          id="filter-work-arrangement"
          label="Work arrangement"
          value={state.workArrangement}
          options={WORK_ARRANGEMENT_OPTIONS}
          onChange={(v) => setField('workArrangement', v)}
        />
        <FilterSelect
          id="filter-employment-type"
          label="Employment type"
          value={state.employmentType}
          options={EMPLOYMENT_TYPE_OPTIONS}
          onChange={(v) => setField('employmentType', v)}
        />
        <FilterSelect
          id="filter-seniority"
          label="Seniority"
          value={state.seniority}
          options={SENIORITY_OPTIONS}
          onChange={(v) => setField('seniority', v)}
        />
        <FilterSelect
          id="filter-source"
          label="Source"
          value={state.source}
          options={SOURCE_TYPE_OPTIONS}
          onChange={(v) => setField('source', v)}
        />
      </FilterGroup>

      <Separator />

      <FilterGroup title="State and freshness">
        <FilterSelect
          id="filter-state"
          label="Your state"
          value={state.state}
          options={STATE_FILTER_OPTIONS}
          placeholder="Any"
          onChange={(v) => setField('state', v)}
        />
        <FilterSelect
          id="filter-freshness"
          label="Freshness"
          value={state.freshness}
          options={FRESHNESS_OPTIONS}
          placeholder="Any time"
          onChange={(v) => setField('freshness', v)}
        />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Dates">
        <FilterTextInput
          id="filter-posted-after"
          label="Posted after"
          type="date"
          value={state.postedAfter}
          onCommit={(v) => setField('postedAfter', v)}
        />
        <FilterTextInput
          id="filter-posted-before"
          label="Posted before"
          type="date"
          value={state.postedBefore}
          onCommit={(v) => setField('postedBefore', v)}
        />
        <FilterTextInput
          id="filter-first-seen-after"
          label="First seen after"
          type="date"
          value={state.firstSeenAfter}
          onCommit={(v) => setField('firstSeenAfter', v)}
        />
        <FilterTextInput
          id="filter-first-seen-before"
          label="First seen before"
          type="date"
          value={state.firstSeenBefore}
          onCommit={(v) => setField('firstSeenBefore', v)}
        />
        <FilterTextInput
          id="filter-closes-before"
          label="Closes before"
          type="date"
          value={state.closesBefore}
          onCommit={(v) => setField('closesBefore', v)}
        />
      </FilterGroup>
    </div>
  );
}
