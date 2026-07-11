'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button, Tooltip, TooltipContent, TooltipTrigger, cn } from '@careerstack/ui';
import { APP_NAV } from '@/lib/nav';
import { BrandMark } from '@/components/marketing/brand-mark';
import { ActiveProfileIndicator } from './active-profile-indicator';

/** Is `href` the active route (exact for `/app`, prefix for nested routes)? */
function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Persistent, collapsible desktop sidebar (Req 3.1). Collapse state is passed
 * in from the shell (persisted there). Admin-only entries render only for
 * admins. Uses the design's dedicated sidebar tokens.
 */
export function AppSidebar({
  collapsed,
  onToggleCollapse,
  isAdmin,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const items = APP_NAV.filter((item) => isAdmin || !item.adminOnly);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground transition-[width] duration-200 md:flex',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <div className={cn('flex h-10 items-center', collapsed ? 'justify-center' : 'px-1')}>
        <Link
          href="/app"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Go to home"
        >
          <BrandMark showName={!collapsed} className={cn(collapsed ? 'text-base' : 'text-lg')} />
        </Link>
      </div>

      <ActiveProfileIndicator collapsed={collapsed} />

      <nav aria-label="Primary" className="flex-1">
        <ul className="flex flex-col gap-1">
          {items.map(({ label, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            const link = (
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  collapsed && 'justify-center px-0',
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {!collapsed ? <span className="truncate">{label}</span> : null}
                {collapsed ? <span className="sr-only">{label}</span> : null}
              </Link>
            );

            return (
              <li key={href}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleCollapse}
        className={cn(
          'justify-start gap-3 text-sidebar-foreground/80',
          collapsed && 'justify-center',
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-pressed={collapsed}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-5" aria-hidden />
        ) : (
          <PanelLeftClose className="size-5" aria-hidden />
        )}
        {!collapsed ? <span>Collapse</span> : null}
      </Button>
    </aside>
  );
}
