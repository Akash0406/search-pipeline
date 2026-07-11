'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Badge, Input, cn } from '@careerstack/ui';

/**
 * Accessible tag / chip input (Req 11, 12, 13.1 — titles, skills, locations).
 *
 * Values are added by typing and pressing Enter or comma, and removed with the
 * chip's remove button or Backspace on an empty field. Duplicates and blank
 * entries are ignored. The control is fully keyboard-operable and announces the
 * current values to assistive tech (Req 57): each chip exposes an accessible
 * remove label, and the live region reflects additions/removals.
 */
export interface ChipInputProps {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  description?: string;
  /** Optional accessible tone for the chips (e.g., excluded titles). */
  tone?: 'default' | 'muted' | 'destructive';
}

export function ChipInput({
  id,
  label,
  values,
  onChange,
  placeholder,
  description,
  tone = 'default',
}: ChipInputProps) {
  const [draft, setDraft] = React.useState('');
  const descriptionId = description ? `${id}-description` : undefined;
  const listId = `${id}-values`;

  const commit = React.useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
        setDraft('');
        return;
      }
      onChange([...values, value]);
      setDraft('');
    },
    [onChange, values],
  );

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(draft);
    } else if (event.key === 'Backspace' && draft.length === 0 && values.length > 0) {
      event.preventDefault();
      removeAt(values.length - 1);
    }
  };

  const badgeVariant =
    tone === 'destructive' ? 'destructive' : tone === 'muted' ? 'muted' : 'secondary';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}

      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        aria-describedby={cn(descriptionId, values.length > 0 ? listId : undefined) || undefined}
        autoComplete="off"
      />

      {values.length > 0 ? (
        <ul id={listId} className="flex flex-wrap gap-1.5 pt-1" aria-label={`${label} values`}>
          {values.map((value, index) => (
            <li key={`${value}-${index}`}>
              <Badge variant={badgeVariant} className="gap-1 pr-1">
                <span className="truncate">{value}</span>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-current/70 transition-colors hover:bg-background/40 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remove ${value}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Politely announce the current count to screen readers. */}
      <span className="sr-only" aria-live="polite">
        {values.length} {values.length === 1 ? 'item' : 'items'} in {label}
      </span>
    </div>
  );
}
