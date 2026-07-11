'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@careerstack/ui';

/**
 * Destructive-action confirmation for deleting a role profile (Req 19.2). Uses
 * the accessible design-system Dialog (roles, labels, focus trap — Req 57) and
 * defaults focus to the safe Cancel action.
 */
export function DeleteProfileDialog({
  open,
  onOpenChange,
  profileName,
  isActive,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName: string;
  isActive: boolean;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{profileName}”?</DialogTitle>
          <DialogDescription>
            This permanently removes the profile and its preferences. This can&apos;t be undone.
            {isActive ? ' Because it’s your active profile, we’ll switch you to another one.' : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Deleting…
              </>
            ) : (
              'Delete profile'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
