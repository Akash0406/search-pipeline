'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button, cn } from '@careerstack/ui';
import { BrandMark } from '@/components/marketing/brand-mark';
import { ThemeToggle } from '@/components/theme-toggle';
import { Breadcrumbs } from './breadcrumbs';
import { UserMenu } from './user-menu';
import { OnlineIndicator, SourceHealthIndicator } from './status-indicators';

/**
 * Sticky application top bar. Hosts the brand (mobile), breadcrumbs, the
 * visible command-palette control (Req 3.3), health/connectivity indicators,
 * the theme switcher (Req 3.5), and the user menu.
 */
export function AppTopbar({ onOpenCommand }: { onOpenCommand: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      {/* Brand shows on mobile where the sidebar is hidden. */}
      <Link
        href="/app"
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label="Go to home"
      >
        <BrandMark showName={false} />
      </Link>

      <div className="hidden min-w-0 flex-1 md:block">
        <Breadcrumbs />
      </div>

      {/* Visible command-palette control (Req 3.3). */}
      <Button
        variant="outline"
        onClick={onOpenCommand}
        className={cn(
          'ml-auto h-9 gap-2 text-muted-foreground md:ml-0 md:w-64 md:justify-start',
        )}
        aria-label="Open command palette"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden md:inline">Search…</span>
        <kbd className="ml-auto hidden items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground md:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <div className="flex items-center gap-2">
        <SourceHealthIndicator />
        <OnlineIndicator />
        <ThemeToggle persist />
        <UserMenu />
      </div>
    </header>
  );
}
