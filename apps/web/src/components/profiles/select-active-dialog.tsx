'use client';

import * as React from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { RoleProfileListItem } from '@careerstack/contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@careerstack/ui';

/**
 * Prompt the user to choose a new Active_Role_Profile (Req 18.2 pausing the
 * active profile, Req 19.3 deleting the active profile). The dialog is fully
 * keyboard-operable with proper roles/labels and focus management via the
 * design-system Dialog (Req 57).
 */
export function SelectActiveProfileDialog({
  open,
  onOpenChange,
  title,
  description,
  candidates,
  onSelect,
  pending,
  confirmLabel = 'Set as active',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  candidates: RoleProfileListItem[];
  onSelect: (id: string) => void;
  pending: boolean;
  confirmLabel?: string;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Default to the first candidate whenever the dialog (re)opens.
  React.useEffect(() => {
    if (open) setSelectedId(candidates[0]?.id ?? null);
  }, [open, candidates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ul className="max-h-64 space-y-1 overflow-y-auto" aria-label="Candidate profiles">
          {candidates.map((profile) => {
            const selected = profile.id === selectedId;
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedId(profile.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  <span className="min-w-0 truncate font-medium">{profile.name}</span>
                  <span className="flex items-center gap-2">
                    {profile.status === 'paused' ? (
                      <span className="text-xs text-muted-foreground">Paused</span>
                    ) : null}
                    <Check
                      className={cn('size-4 text-primary', selected ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedId && onSelect(selectedId)}
            disabled={pending || !selectedId}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
