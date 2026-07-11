'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import type { Connection } from '@careerstack/contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@careerstack/ui';
import { ApiError } from '@/lib/api/client';
import { useRemoveConnection } from '@/lib/api/connections';
import { connectionLabel } from '@/lib/connection-options';

/**
 * Destructive-action confirmation for removing a connection (Req 25.2). Makes
 * explicit that previously ingested opportunities remain accessible (Req 25.3).
 */
export function RemoveConnectionDialog({
  connection,
  onOpenChange,
}: {
  connection: Connection | null;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useRemoveConnection();

  const onConfirm = () => {
    if (!connection) return;
    const label = connectionLabel(connection);
    remove.mutate(connection.id, {
      onSuccess: () => {
        toast.success('Source removed', {
          description: `${label} won’t be scheduled anymore. Opportunities already found stay accessible.`,
        });
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error('Couldn’t remove the source', {
          description: error instanceof ApiError ? error.message : 'Please try again in a moment.',
        });
      },
    });
  };

  return (
    <Dialog open={Boolean(connection)} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove “{connection ? connectionLabel(connection) : ''}”?</DialogTitle>
          <DialogDescription>
            We’ll stop scheduling runs for this source. Opportunities already discovered from it
            stay accessible — nothing is deleted. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={remove.isPending}>
            {remove.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Removing…
              </>
            ) : (
              'Remove source'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
