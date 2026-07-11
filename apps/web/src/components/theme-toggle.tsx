'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { Theme } from '@careerstack/contracts';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@careerstack/ui';
import { persistTheme } from '@/lib/api/hooks';

const OPTIONS: {
  value: Theme;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Theme switcher (Req 3.5, 3.6). Applies the selection instantly via next-themes
 * (class strategy, no reload) and best-effort persists it to the API so it
 * follows the user across devices.
 *
 * @param persist when true, also write the choice to `/me/preferences` (only
 * meaningful for authenticated users).
 */
export function ThemeToggle({ persist = false }: { persist?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const active = (theme ?? 'system') as Theme;

  const onSelect = (next: string) => {
    const value = next as Theme;
    setTheme(value);
    if (persist) persistTheme(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          {/* Avoid a hydration flash: show a neutral icon until mounted. */}
          <Sun className="size-5 dark:hidden" aria-hidden />
          <Moon className="hidden size-5 dark:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={mounted ? active : ''} onValueChange={onSelect}>
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="gap-2">
              <Icon className="size-4" aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
