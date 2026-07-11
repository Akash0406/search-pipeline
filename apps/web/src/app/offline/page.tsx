import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { Button } from '@careerstack/ui';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <WifiOff className="size-8" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
        <p className="max-w-md text-muted-foreground">
          {BRAND_NAME} can&apos;t reach the network right now. Reconnect to browse opportunities and
          your workspace.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
