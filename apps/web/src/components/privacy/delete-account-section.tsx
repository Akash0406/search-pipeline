'use client';

import * as React from 'react';
import { Loader2, OctagonAlert } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from '@careerstack/ui';
import { ApiError } from '@/lib/api/client';
import { useDeleteAccount } from '@/lib/api/privacy';

/** The exact phrase the user must type to unlock account deletion. */
const CONFIRM_PHRASE = 'DELETE';

/**
 * Permanently delete the account (Req 7, 50.1). This is the highest-friction,
 * clearly-separated destructive action: it lives in its own danger-styled card,
 * requires opening a confirmation dialog, AND requires typing an explicit
 * confirmation phrase before the button enables (Req 14 destructive-action
 * rule). On success the session is already invalidated server-side, so we do a
 * full navigation back to the public site.
 */
export function DeleteAccountSection() {
  const [open, setOpen] = React.useState(false);
  const [phrase, setPhrase] = React.useState('');
  const deleteAccount = useDeleteAccount();

  const confirmed = phrase.trim().toUpperCase() === CONFIRM_PHRASE;

  const onConfirm = () => {
    if (!confirmed) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        toast.success('Your account has been deleted');
        // Session is cleared server-side; leave the authenticated app entirely.
        window.location.assign('/');
      },
      onError: (error) => {
        toast.error('Couldn’t delete your account', {
          description:
            error instanceof ApiError ? error.message : 'Please try again in a moment.',
        });
      },
    });
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <OctagonAlert className="size-4" aria-hidden />
          Delete account
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data — profiles, saved and dismissed
          opportunities, sessions, and connected sources. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setPhrase('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete your account?</DialogTitle>
            <DialogDescription>
              This removes everything we hold about you and signs you out of every device. There is
              no way to recover it. To continue, type{' '}
              <span className="font-semibold text-foreground">{CONFIRM_PHRASE}</span> below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Confirmation</Label>
            <Input
              id="delete-confirm"
              value={phrase}
              autoComplete="off"
              placeholder={CONFIRM_PHRASE}
              onChange={(e) => setPhrase(e.target.value)}
              aria-describedby="delete-confirm-hint"
            />
            <p id="delete-confirm-hint" className="text-xs text-muted-foreground">
              Type {CONFIRM_PHRASE} exactly to enable the delete button.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setPhrase('');
              }}
              disabled={deleteAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={!confirmed || deleteAccount.isPending}
            >
              {deleteAccount.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                'Delete account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
