'use client';

import * as React from 'react';
import { Loader2, LogOut, Monitor, ShieldCheck } from 'lucide-react';
import {
  Badge,
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
  Skeleton,
  toast,
} from '@careerstack/ui';
import type { SessionListItem } from '@careerstack/contracts';
import { ApiError } from '@/lib/api/client';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '@/lib/api/privacy';
import { EmptyState, ErrorState } from '@/components/common/states';
import { DateTime } from '@/components/common/date-time';

/** Short device summary derived from the raw user-agent string. */
function deviceLabel(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent;
  const browser =
    /edg/i.test(ua) ? 'Edge'
    : /chrome|crios/i.test(ua) ? 'Chrome'
    : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /safari/i.test(ua) ? 'Safari'
    : 'Browser';
  const os =
    /windows/i.test(ua) ? 'Windows'
    : /mac os|macintosh/i.test(ua) ? 'macOS'
    : /android/i.test(ua) ? 'Android'
    : /iphone|ipad|ios/i.test(ua) ? 'iOS'
    : /linux/i.test(ua) ? 'Linux'
    : 'Unknown OS';
  return `${browser} · ${os}`;
}

/**
 * Active sessions list + revocation (Req 6). Shows each session's device,
 * approximate location, and last activity (timezone-aware), lets the user
 * revoke any individual session, and offers a confirmation-gated "sign out
 * everywhere else" that keeps the current session (Req 6.2, 6.3, destructive
 * confirmation Req 14).
 */
export function SessionsClient() {
  const query = useSessions();
  const revokeOne = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [target, setTarget] = React.useState<SessionListItem | null>(null);
  const [othersOpen, setOthersOpen] = React.useState(false);

  const sessions = query.data?.sessions ?? [];
  const otherCount = sessions.filter((s) => !s.current).length;

  const onRevokeOne = () => {
    if (!target) return;
    revokeOne.mutate(target.id, {
      onSuccess: () => {
        toast.success('Session revoked');
        setTarget(null);
      },
      onError: (error) => {
        toast.error('Couldn’t revoke that session', {
          description: error instanceof ApiError ? error.message : 'Please try again.',
        });
      },
    });
  };

  const onRevokeOthers = () => {
    revokeOthers.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(
          result.revoked === 1
            ? 'Signed out 1 other session'
            : `Signed out ${result.revoked} other sessions`,
        );
        setOthersOpen(false);
      },
      onError: (error) => {
        toast.error('Couldn’t sign out other sessions', {
          description: error instanceof ApiError ? error.message : 'Please try again.',
        });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
          Active sessions
        </CardTitle>
        <CardDescription>
          Devices currently signed in to your account. Revoke any you don’t recognise.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState title="Couldn’t load your sessions" onRetry={() => void query.refetch()} />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="No active sessions"
            description="You don’t have any other active sessions right now."
          />
        ) : (
          <>
            <ul className="divide-y rounded-lg border">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <Monitor className="size-4 text-muted-foreground" aria-hidden />
                      {deviceLabel(session.userAgent)}
                      {session.current ? (
                        <Badge variant="success" className="ml-1">
                          This device
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {session.approxLocation ? `${session.approxLocation} · ` : ''}
                      Last active <DateTime value={session.lastActiveAt} />
                    </p>
                  </div>
                  {session.current ? (
                    <span className="text-xs text-muted-foreground">Current</span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setTarget(session)}>
                      <LogOut className="size-4" aria-hidden />
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            {otherCount > 0 ? (
              <Button
                variant="outline"
                onClick={() => setOthersOpen(true)}
                disabled={revokeOthers.isPending}
              >
                Sign out all other sessions
              </Button>
            ) : null}
          </>
        )}
      </CardContent>

      {/* Revoke a single session */}
      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this session?</DialogTitle>
            <DialogDescription>
              The device “{target ? deviceLabel(target.userAgent) : ''}” will be signed out
              immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={revokeOne.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onRevokeOne} disabled={revokeOne.isPending}>
              {revokeOne.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Revoking…
                </>
              ) : (
                'Revoke session'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke all other sessions */}
      <Dialog open={othersOpen} onOpenChange={setOthersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out all other sessions?</DialogTitle>
            <DialogDescription>
              This signs out every device except the one you’re using now. You’ll stay signed in
              here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOthersOpen(false)}
              disabled={revokeOthers.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onRevokeOthers}
              disabled={revokeOthers.isPending}
            >
              {revokeOthers.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Signing out…
                </>
              ) : (
                'Sign out others'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
