'use client';

import * as React from 'react';
import { cn, Input } from '@careerstack/ui';

const SELECT_CLASS = cn(
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

/** A labelled native `<select>` — fully keyboard accessible (Req 41 / 57). */
export function FilterSelect<T extends string>({
  id,
  label,
  value,
  options,
  placeholder = 'Any',
  onChange,
}: {
  id: string;
  label: string;
  value: T | undefined;
  options: ReadonlyArray<{ value: T; label: string }>;
  placeholder?: string;
  onChange: (value: T | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className={SELECT_CLASS}
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A labelled text input that commits its value on a short debounce, so typing
 * does not thrash the URL/query on every keystroke while still reflecting the
 * active filter (Req 41.5). Stays in sync when the incoming `value` changes
 * (e.g., a chip clears the filter or the URL is restored).
 */
export function FilterTextInput({
  id,
  label,
  value,
  placeholder,
  onCommit,
  type = 'text',
  debounceMs = 400,
}: {
  id: string;
  label: string;
  value: string | undefined;
  placeholder?: string;
  onCommit: (value: string | undefined) => void;
  type?: 'text' | 'date';
  debounceMs?: number;
}) {
  const [local, setLocal] = React.useState(value ?? '');

  // Re-sync when the source of truth changes from outside (chips / URL restore).
  React.useEffect(() => {
    setLocal(value ?? '');
  }, [value]);

  React.useEffect(() => {
    const current = value ?? '';
    if (local === current) return;
    const handle = setTimeout(() => onCommit(local || undefined), type === 'date' ? 0 : debounceMs);
    return () => clearTimeout(handle);
  }, [local]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
      />
    </div>
  );
}
