'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { Theme } from '@careerstack/contracts';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@careerstack/ui';
import { APP_NAV } from '@/lib/nav';
import { persistTheme } from '@/lib/api/hooks';

/**
 * Global command palette (Req 3.3). Opens via ⌘K / Ctrl+K and via the visible
 * control in the topbar. Provides keyboard-first navigation and quick actions
 * (theme switch). Built on cmdk with accessible dialog roles/labels (Req 57.4).
 */
export function CommandPalette({
  open,
  onOpenChange,
  isAdmin = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();

  // Global keyboard shortcut (⌘K / Ctrl+K).
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const run = React.useCallback(
    (action: () => void) => {
      onOpenChange(false);
      action();
    },
    [onOpenChange],
  );

  const navItems = APP_NAV.filter((item) => isAdmin || !item.adminOnly);

  const applyTheme = (theme: Theme) => {
    setTheme(theme);
    persistTheme(theme);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search navigation and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {navItems.map(({ label, href, icon: Icon }) => (
            <CommandItem
              key={href}
              value={`Go to ${label}`}
              onSelect={() => run(() => router.push(href))}
            >
              <Icon className="size-4" aria-hidden />
              <span>{label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem value="Theme light" onSelect={() => run(() => applyTheme('light'))}>
            <Sun className="size-4" aria-hidden />
            <span>Light</span>
          </CommandItem>
          <CommandItem value="Theme dark" onSelect={() => run(() => applyTheme('dark'))}>
            <Moon className="size-4" aria-hidden />
            <span>Dark</span>
          </CommandItem>
          <CommandItem value="Theme system" onSelect={() => run(() => applyTheme('system'))}>
            <Monitor className="size-4" aria-hidden />
            <span>System</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem
            value="Create role profile"
            onSelect={() => run(() => router.push('/app/profiles?new=1'))}
          >
            <span>Create a role profile</span>
            <CommandShortcut>Profiles</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
