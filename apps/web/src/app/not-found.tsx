import Link from 'next/link';
import { Button } from '@careerstack/ui';

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <p className="text-sm font-medium text-primary">404</p>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-md text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Open app</Link>
        </Button>
      </div>
    </main>
  );
}
