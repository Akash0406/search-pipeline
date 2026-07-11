'use client';

import * as React from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import type { GoogleOAuthStartResponse, MagicLinkRequestResponse } from '@careerstack/contracts';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
} from '@careerstack/ui';
import { apiFetch, ApiError } from '@/lib/api/client';

/** Non-technical copy for each error code the API redirects back with (Req 4.3, 5.3). */
const ERROR_MESSAGES: Record<string, string> = {
  sign_in_cancelled: 'Sign-in was cancelled. You can try again below.',
  sign_in_failed: 'We couldn’t complete sign-in. Please try again.',
  magic_link_invalid: 'That sign-in link is invalid or has expired. Request a new one below.',
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function SignInForm({
  returnTo,
  initialError,
  offerResend = false,
}: {
  returnTo?: string;
  initialError?: string;
  offerResend?: boolean;
}) {
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'google' | 'magic' | 'sent'>('idle');
  const [error, setError] = React.useState<string | undefined>(
    initialError ? (ERROR_MESSAGES[initialError] ?? 'Please try signing in again.') : undefined,
  );

  const onGoogle = async () => {
    setError(undefined);
    setStatus('google');
    try {
      const res = await apiFetch<GoogleOAuthStartResponse>('/auth/oauth/google/start', {
        method: 'POST',
        json: returnTo ? { returnTo } : {},
      });
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setStatus('idle');
      setError(
        err instanceof ApiError
          ? 'Google sign-in is unavailable right now. Please try the email option.'
          : 'Something went wrong. Please try again.',
      );
    }
  };

  const onMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setStatus('magic');
    try {
      await apiFetch<MagicLinkRequestResponse>('/auth/magic-link', {
        method: 'POST',
        json: { email, ...(returnTo ? { returnTo } : {}) },
      });
      setStatus('sent');
    } catch (err) {
      setStatus('idle');
      setError(
        err instanceof ApiError && err.code === 'VALIDATION_ERROR'
          ? 'Please enter a valid email address.'
          : 'We couldn’t send the link. Please try again.',
      );
    }
  };

  if (status === 'sent') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-success/12 text-success">
            <Mail className="size-6" aria-hidden />
          </div>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a single-use sign-in
            link. It expires in a few minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => setStatus('idle')}>
            Use a different email
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Didn&apos;t get it? Check spam, or request another link.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Sign in or create your account</CardTitle>
        <CardDescription>Passwordless — no password to remember or manage.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <p>{error}</p>
            {offerResend ? (
              <p className="text-xs text-destructive/80">
                Enter your email below and we&apos;ll send a fresh link.
              </p>
            ) : null}
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGoogle}
          disabled={status === 'google'}
        >
          <GoogleIcon className="size-4" />
          {status === 'google' ? 'Redirecting…' : 'Continue with Google'}
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={onMagicLink} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={status === 'magic' || email.length === 0}
          >
            {status === 'magic' ? 'Sending link…' : 'Email me a sign-in link'}
          </Button>
        </form>

        {/* Privacy reassurance (Req 4.5 / SRC-009): we never touch job-platform passwords. */}
        <p className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span>
            We never ask for your job-platform passwords. Sign-in uses Google or a one-time email
            link only.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
