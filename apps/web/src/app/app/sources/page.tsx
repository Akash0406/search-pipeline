import type { Metadata } from 'next';
import * as React from 'react';
import { Skeleton } from '@careerstack/ui';
import { SourcesManager } from '@/components/sources/sources-manager';

export const metadata: Metadata = {
  title: 'Sources',
};

/**
 * Sources/connections surface (Req 20–26, Design §8 `/app/sources`). The client
 * `SourcesManager` owns data, the required empty/loading/error states, the
 * add-source wizard, run history, and the manual-URL flow. Wrapped in Suspense
 * because it reads search params for deep-linked quick actions.
 */
export default function SourcesPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SourcesManager />
    </React.Suspense>
  );
}
