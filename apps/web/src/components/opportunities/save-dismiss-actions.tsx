'use client';

import * as React from 'react';
import { Bookmark, BookmarkCheck, Undo2, X } from 'lucide-react';
import { Button, toast } from '@careerstack/ui';
import type { UserState } from '@careerstack/contracts';
import { ApiError } from '@/lib/api/client';
import {
  useDismissOpportunity,
  useSaveOpportunity,
  useUndismissOpportunity,
  useUnsaveOpportunity,
} from '@/lib/api/opportunities';

export interface SaveDismissActionsProps {
  opportunityId: string;
  title: string;
  userState: UserState;
  /** `icon` for compact rows, `full` for cards/detail with labels. */
  variant?: 'icon' | 'full';
  className?: string;
}

/**
 * Optimistic per-user save/dismiss controls with Sonner toasts + one-tap
 * reversal (Req 43.1–43.3). The mutations patch the query caches immediately
 * and roll back on failure; the toast offers an "Undo" action that reverses the
 * change, so the state is always recoverable.
 */
export function SaveDismissActions({
  opportunityId,
  title,
  userState,
  variant = 'full',
  className,
}: SaveDismissActionsProps) {
  const save = useSaveOpportunity();
  const unsave = useUnsaveOpportunity();
  const dismiss = useDismissOpportunity();
  const undismiss = useUndismissOpportunity();

  const busy = save.isPending || unsave.isPending || dismiss.isPending || undismiss.isPending;
  const isSaved = userState === 'saved';
  const isDismissed = userState === 'dismissed';

  const reportError = (err: unknown, fallback: string) =>
    toast.error(err instanceof ApiError ? err.message : fallback);

  const onSaveToggle = () => {
    if (isSaved) {
      unsave.mutate(opportunityId, {
        onError: (err) => reportError(err, 'Couldn’t update. Please try again.'),
      });
      return;
    }
    save.mutate(opportunityId, {
      onSuccess: () =>
        toast.success(`Saved “${title}”`, {
          action: {
            label: 'Undo',
            onClick: () => unsave.mutate(opportunityId),
          },
        }),
      onError: (err) => reportError(err, 'Couldn’t save. Please try again.'),
    });
  };

  const onDismissToggle = () => {
    if (isDismissed) {
      undismiss.mutate(opportunityId, {
        onError: (err) => reportError(err, 'Couldn’t update. Please try again.'),
      });
      return;
    }
    dismiss.mutate(opportunityId, {
      onSuccess: () =>
        toast(`Dismissed “${title}”`, {
          action: {
            label: 'Undo',
            onClick: () => undismiss.mutate(opportunityId),
          },
        }),
      onError: (err) => reportError(err, 'Couldn’t dismiss. Please try again.'),
    });
  };

  if (variant === 'icon') {
    return (
      <div className={className}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy}
          aria-pressed={isSaved}
          aria-label={isSaved ? `Remove “${title}” from saved` : `Save “${title}”`}
          title={isSaved ? 'Saved' : 'Save'}
          onClick={onSaveToggle}
        >
          {isSaved ? (
            <BookmarkCheck className="size-4 text-primary" aria-hidden />
          ) : (
            <Bookmark className="size-4" aria-hidden />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy}
          aria-pressed={isDismissed}
          aria-label={isDismissed ? `Restore “${title}”` : `Dismiss “${title}”`}
          title={isDismissed ? 'Dismissed' : 'Dismiss'}
          onClick={onDismissToggle}
        >
          {isDismissed ? <Undo2 className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={isSaved ? 'secondary' : 'outline'}
        size="sm"
        disabled={busy}
        aria-pressed={isSaved}
        onClick={onSaveToggle}
      >
        {isSaved ? (
          <BookmarkCheck className="size-4" aria-hidden />
        ) : (
          <Bookmark className="size-4" aria-hidden />
        )}
        {isSaved ? 'Saved' : 'Save'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        aria-pressed={isDismissed}
        onClick={onDismissToggle}
      >
        {isDismissed ? <Undo2 className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
        {isDismissed ? 'Restore' : 'Dismiss'}
      </Button>
    </div>
  );
}
