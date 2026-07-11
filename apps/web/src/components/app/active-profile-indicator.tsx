'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, ChevronsUpDown, Plus, UserCircle } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  cn,
  toast,
} from '@careerstack/ui';
import { ApiError } from '@/lib/api/client';
import { useActivateRoleProfile, useMe, useRoleProfiles } from '@/lib/api/hooks';

/**
 * Always-visible Active Role Profile indicator with a quick switcher (Req 3.4).
 *
 * Reads the user's profiles from the API and highlights the active one. When
 * the list is empty or the API is unreachable it degrades gracefully to a
 * "no active profile" affordance that links to profile creation — the shell
 * never renders without an indicator.
 */
export function ActiveProfileIndicator({ collapsed = false }: { collapsed?: boolean }) {
  const me = useMe();
  const profiles = useRoleProfiles();
  const activate = useActivateRoleProfile();

  const list = profiles.data?.profiles ?? [];
  const activeId = me.data?.activeRoleProfileId ?? list.find((p) => p.isActive)?.id ?? null;
  const active = list.find((p) => p.id === activeId) ?? null;

  if (profiles.isLoading || me.isLoading) {
    return <Skeleton className="h-11 w-full" />;
  }

  const label = active?.name ?? (list.length === 0 ? 'No profile yet' : 'No active profile');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-11 w-full justify-between gap-2 px-2.5 text-left',
            collapsed && 'w-11 justify-center px-0',
          )}
          aria-label={`Active role profile: ${label}. Switch profile`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary"
            >
              <UserCircle className="size-4" />
            </span>
            {!collapsed ? (
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Active profile
                </span>
                <span className="truncate text-sm font-medium">{label}</span>
              </span>
            ) : null}
          </span>
          {!collapsed ? (
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch active profile</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {list.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            You don&apos;t have any role profiles yet.
          </p>
        ) : (
          list.map((profile) => (
            <DropdownMenuItem
              key={profile.id}
              disabled={activate.isPending}
              onSelect={(event) => {
                event.preventDefault();
                if (profile.id === activeId) return;
                activate.mutate(profile.id, {
                  onSuccess: () => toast.success(`Switched to “${profile.name}”`),
                  onError: (err) =>
                    toast.error(
                      err instanceof ApiError
                        ? err.message
                        : 'Couldn’t switch profiles. Please try again.',
                    ),
                });
              }}
            >
              <Check
                className={cn('size-4', profile.id === activeId ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              <span className="truncate">{profile.name}</span>
              {profile.status === 'paused' ? (
                <span className="ml-auto text-xs text-muted-foreground">Paused</span>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/profiles?new=1">
            <Plus className="size-4" aria-hidden />
            Create a role profile
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
