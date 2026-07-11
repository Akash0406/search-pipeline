'use client';

import * as React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import type { WorkRights } from '@careerstack/contracts';
import { Button, Label, cn } from '@careerstack/ui';
import { ChipInput } from '@/components/forms/chip-input';

/**
 * Optional, PRIVATE work-rights collection (Req 16).
 *
 * A clear explanation of WHY the data helps and HOW it is handled is shown
 * BEFORE any field is collected (Req 16.2): the data is optional (16.1),
 * private to the owner (16.3), and is never inferred from nationality or
 * location (16.4). The user must explicitly opt in to reveal the fields;
 * leaving it off keeps work rights unspecified (16.5).
 */
export interface WorkRightsValue {
  requiresSponsorship?: boolean;
  visaTypes: string[];
  note: string;
}

export const EMPTY_WORK_RIGHTS: WorkRightsValue = {
  visaTypes: [],
  note: '',
};

/** Normalize a DTO WorkRights into the editor's value shape. */
export function workRightsToValue(wr: WorkRights | undefined): {
  enabled: boolean;
  value: WorkRightsValue;
} {
  if (!wr) return { enabled: false, value: EMPTY_WORK_RIGHTS };
  const value: WorkRightsValue = {
    visaTypes: wr.visaTypes ?? [],
    note: wr.note ?? '',
  };
  if (wr.requiresSponsorship !== undefined) value.requiresSponsorship = wr.requiresSponsorship;
  return { enabled: true, value };
}

/** Convert the editor value back to a DTO, or `undefined` when effectively empty. */
export function valueToWorkRights(
  enabled: boolean,
  value: WorkRightsValue,
): WorkRights | undefined {
  if (!enabled) return undefined;
  const dto: WorkRights = {};
  if (value.requiresSponsorship !== undefined) dto.requiresSponsorship = value.requiresSponsorship;
  if (value.visaTypes.length > 0) dto.visaTypes = value.visaTypes;
  if (value.note.trim().length > 0) dto.note = value.note.trim();
  return Object.keys(dto).length > 0 ? dto : undefined;
}

export function WorkRightsSection({
  enabled,
  value,
  onEnabledChange,
  onValueChange,
}: {
  enabled: boolean;
  value: WorkRightsValue;
  onEnabledChange: (enabled: boolean) => void;
  onValueChange: (value: WorkRightsValue) => void;
}) {
  const sponsorship = value.requiresSponsorship;

  return (
    <section
      aria-labelledby="work-rights-heading"
      className="rounded-xl border border-border bg-muted/30 p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <ShieldCheck className="size-5" />
        </span>
        <div className="space-y-1">
          <h3 id="work-rights-heading" className="text-sm font-semibold">
            Work-rights (optional &amp; private)
          </h3>
          {/* Explainer shown BEFORE collection (Req 16.2). */}
          <p className="text-sm text-muted-foreground">
            Telling us your work-rights lets us filter out roles you are not eligible for — for
            example, positions that can&apos;t offer visa sponsorship. It&apos;s completely optional.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            This is private to you, and we never infer your status from your nationality or location
            (Req 16.4).
          </p>
        </div>
      </div>

      {!enabled ? (
        <div className="mt-3 pl-12">
          <Button type="button" variant="outline" size="sm" onClick={() => onEnabledChange(true)}>
            Add work-rights details
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4 pl-0 sm:pl-12">
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Do you require visa sponsorship?</legend>
            <div className="flex flex-wrap gap-2 pt-1">
              {(
                [
                  { key: 'yes', label: 'Yes', val: true },
                  { key: 'no', label: 'No', val: false },
                  { key: 'unsure', label: 'Prefer not to say', val: undefined },
                ] as const
              ).map((opt) => {
                const selected = sponsorship === opt.val;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      const next: WorkRightsValue = {
                        visaTypes: value.visaTypes,
                        note: value.note,
                      };
                      if (opt.val !== undefined) next.requiresSponsorship = opt.val;
                      onValueChange(next);
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <ChipInput
            id="work-rights-visas"
            label="Visa / permit types (optional)"
            description="e.g. F-1 OPT, H-1B, EU citizen, Tier 2. Enter one at a time."
            values={value.visaTypes}
            onChange={(visaTypes) => onValueChange({ ...value, visaTypes })}
            placeholder="Add a visa or permit type"
          />

          <div className="space-y-1.5">
            <Label htmlFor="work-rights-note">Anything else (optional)</Label>
            <textarea
              id="work-rights-note"
              rows={2}
              value={value.note}
              onChange={(e) => onValueChange({ ...value, note: e.target.value })}
              placeholder="Any additional context about your eligibility."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onEnabledChange(false);
              onValueChange(EMPTY_WORK_RIGHTS);
            }}
          >
            Remove work-rights details
          </Button>
        </div>
      )}
    </section>
  );
}
