'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, ShieldCheck, UserCog } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  toast,
} from '@careerstack/ui';
import { apiFetch, ApiError } from '@/lib/api/client';
import { useMe } from '@/lib/api/hooks';

function initials(source: string): string {
  const parts = source.replace(/@.*/, '').split(/[.\s_-]+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0] ?? '');
  return (chars.join('') || source[0] || '?').toUpperCase();
}

/** User avatar menu: identity, settings shortcuts, and sign out. */
export function UserMenu() {
  const router = useRouter();
  const me = useMe();
  const [signingOut, setSigningOut] = React.useState(false);

  if (me.isLoading) {
    return <Skeleton className="size-9 rounded-full" />;
  }

  const user = me.data;
  const display = user?.displayName?.trim() || user?.email || 'Account';
  const isAdmin = user?.role === 'admin';

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await apiFetch<unknown>('/auth/logout', { method: 'POST' });
    } catch (err) {
      // A network failure shouldn't trap the user in the app.
      if (!(err instanceof ApiError) || err.status >= 500) {
        toast.error('We couldn’t reach the server, signing you out locally.');
      }
    } finally {
      router.push('/signin');
      router.refresh();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={`Account menu for ${display}`}
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/12 text-sm font-medium text-primary">
              {initials(display)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{display}</span>
          {user?.email ? (
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings">
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings/sessions">
            <UserCog className="size-4" aria-hidden />
            Sessions &amp; security
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/connector-health">
              <ShieldCheck className="size-4" aria-hidden />
              Admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void onSignOut();
          }}
        >
          <LogOut className="size-4" aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
