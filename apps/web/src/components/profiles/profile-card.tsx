'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Copy,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Star,
  Trash2,
} from 'lucide-react';
import type { RoleProfileListItem } from '@careerstack/contracts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@careerstack/ui';
import { DateTime } from '@/components/common/date-time';

export interface ProfileCardActions {
  onActivate: (profile: RoleProfileListItem) => void;
  onPause: (profile: RoleProfileListItem) => void;
  onResume: (profile: RoleProfileListItem) => void;
  onDuplicate: (profile: RoleProfileListItem) => void;
  onDelete: (profile: RoleProfileListItem) => void;
}

/**
 * A single role-profile card (Req 10, 17–19). Shows the active badge and
 * status (active/paused), and exposes edit/activate/duplicate/pause/resume/
 * delete actions. The active profile is visually distinguished so the user
 * always knows their current context (Req 3.4).
 */
export function ProfileCard({
  profile,
  busy = false,
  timezone,
  ...actions
}: {
  profile: RoleProfileListItem;
  busy?: boolean;
  timezone?: string;
} & ProfileCardActions) {
  const isPaused = profile.status === 'paused';

  return (
    <Card
      aria-current={profile.isActive ? 'true' : undefined}
      className={profile.isActive ? 'border-primary/60 ring-1 ring-primary/30' : undefined}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <h3 className="truncate font-semibold">{profile.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {profile.isActive ? (
              <Badge variant="default" className="gap-1">
                <Star className="size-3" aria-hidden />
                Active
              </Badge>
            ) : null}
            <Badge variant={isPaused ? 'muted' : 'success'} className="gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
              {isPaused ? 'Paused' : 'Active-eligible'}
            </Badge>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={busy}
              aria-label={`Actions for ${profile.name}`}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href={`/app/profiles/${profile.id}/edit`}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
            </DropdownMenuItem>
            {!profile.isActive ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  actions.onActivate(profile);
                }}
              >
                <Star className="size-4" aria-hidden />
                Set active
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                actions.onDuplicate(profile);
              }}
            >
              <Copy className="size-4" aria-hidden />
              Duplicate
            </DropdownMenuItem>
            {isPaused ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  actions.onResume(profile);
                }}
              >
                <Play className="size-4" aria-hidden />
                Resume
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  actions.onPause(profile);
                }}
              >
                <Pause className="size-4" aria-hidden />
                Pause
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                actions.onDelete(profile);
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="text-xs text-muted-foreground">
        Updated <DateTime value={profile.updatedAt} {...(timezone ? { timezone } : {})} />
      </CardContent>

      <CardFooter className="gap-2">
        {!profile.isActive ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => actions.onActivate(profile)}
          >
            <Star className="size-4" aria-hidden />
            Set active
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/profiles/${profile.id}/edit`}>Edit</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
