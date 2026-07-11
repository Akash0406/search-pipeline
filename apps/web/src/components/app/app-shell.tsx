'use client';

import * as React from 'react';
import { useMe } from '@/lib/api/hooks';
import { useLiveUpdates } from '@/lib/api/use-live-updates';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';
import { MobileNav } from './mobile-nav';
import { CommandPalette } from './command-palette';

const COLLAPSE_STORAGE_KEY = 'cs:sidebar-collapsed';

/**
 * Authenticated application shell (Req 3): persistent collapsible sidebar on
 * desktop, bottom navigation on mobile, a global command palette, the topbar
 * (breadcrumbs, search, indicators, theme, user menu), and the routed content.
 *
 * The admin surface (`/admin/*`) reuses the same shell so navigation stays
 * consistent; admin-only entries appear only for users with the admin role.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const isAdmin = me.data?.role === 'admin';

  // Subscribe to live updates (SSE) once authenticated so run status, export
  // status, and opportunity changes invalidate their caches app-wide (Req 56).
  useLiveUpdates({ enabled: Boolean(me.data) });

  const [collapsed, setCollapsed] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  // Restore the persisted collapse preference after mount (no SSR mismatch).
  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1');
    } catch {
      /* localStorage may be unavailable; default to expanded. */
    }
  }, []);

  const toggleCollapse = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore persistence failure */
      }
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-dvh w-full">
      <AppSidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} isAdmin={isAdmin} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar onOpenCommand={() => setCommandOpen(true)} />
        <main id="main-content" className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-8 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <MobileNav />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} isAdmin={isAdmin} />
    </div>
  );
}
