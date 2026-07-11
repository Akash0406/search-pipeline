import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/marketing/brand-mark';
import { SignInForm } from '@/components/auth/signin-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main
      id="main-content"
      className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary/10 to-transparent"
      />
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to home
      </Link>

      <div className="flex flex-col items-center gap-2">
        <BrandMark className="text-xl" />
      </div>

      <div className="w-full max-w-sm">
        <SignInForm
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
    </main>
  );
}
