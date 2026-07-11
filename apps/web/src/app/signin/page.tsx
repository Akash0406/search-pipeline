import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Radar, ShieldCheck, Sparkles } from 'lucide-react';
import { BrandMark } from '@/components/marketing/brand-mark';
import { SignInForm } from '@/components/auth/signin-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

const HIGHLIGHTS = [
  {
    icon: Radar,
    title: 'The right roles find you',
    description: 'Discovery pulls from company career pages and ATS feeds — no more tab-hopping.',
  },
  {
    icon: Sparkles,
    title: 'Organized around you',
    description: 'Role profiles focus each search on a career direction you care about.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    description: 'We never ask for your job-platform passwords, and your data stays yours.',
  },
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string; resend?: string }>;
}) {
  const params = await searchParams;
  const offerResend = params.resend === '1';

  return (
    <main id="main-content" className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand / value panel — decorative context, hidden on small screens. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-transparent to-transparent"
        />
        <BrandMark className="text-xl" />

        <div className="space-y-8">
          <h1 className="max-w-sm text-3xl font-semibold tracking-tight">
            Let the right opportunities find you.
          </h1>
          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
                >
                  <Icon className="size-5" />
                </span>
                <div className="space-y-0.5">
                  <p className="font-medium">{title}</p>
                  <p className="max-w-xs text-sm text-sidebar-foreground/70">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/60">
          Passwordless sign-in via Google or a one-time email link.
        </p>
      </aside>

      {/* Auth column. */}
      <div className="relative flex flex-col items-center justify-center gap-8 px-5 py-12">
        <div className="flex w-full max-w-sm items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to home
          </Link>
          {/* Brand shows here on mobile where the side panel is hidden. */}
          <span className="lg:hidden">
            <BrandMark />
          </span>
        </div>

        <div className="w-full max-w-sm">
          <SignInForm
            offerResend={offerResend}
            {...(params.returnTo ? { returnTo: params.returnTo } : {})}
            {...(params.error ? { initialError: params.error } : {})}
          />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
