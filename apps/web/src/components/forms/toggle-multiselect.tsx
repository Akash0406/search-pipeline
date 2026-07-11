'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@careerstack/ui';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Accessible multi-select rendered as a group of toggle buttons (Req 13.2 work
 * arrangement, Req 14 employment type + seniority).
 *
 * Each option is a real `<button aria-pressed>` inside a labelled group, so the
 * whole control is keyboard-operable and screen-reader friendly (Req 57) — no
 * custom listbox semantics to get wrong. Selection is order-preserving.
 */
export interface ToggleMultiSelectProps<T extends string> {
  id: string;
  label: string;
  options: ReadonlyArray<ToggleOption<T>>;
  values: T[];
  onChange: (values: T[]) => void;
  description?: string;
}

export function ToggleMultiSelect<T extends string>({
  id,
  label,
  options,
  values,
  onChange,
  description,
}: ToggleMultiSelectProps<T>) {
  const descriptionId = description ? `${id}-description` : undefined;

  const toggle = (value: T) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  return (
    <div className="space-y-1.5" role="group" aria-labelledby={`${id}-label`} aria-describedby={descriptionId}>
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
              )}
            >
              {selected ? <Check className="size-3.5" aria-hidden /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
