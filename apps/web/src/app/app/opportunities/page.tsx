import * as React from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { OpportunityExplorer } from '@/components/opportunities/explorer';
import { ResultsSkeleton } from '@/components/opportunities/result-states';

export const metadata: Metadata = {
  title: 'Opportunities',
};

/**
 * Opportunity explorer route (Req 40–44). The interactive explorer is a client
 * component (URL-driven filters/sort, save/dismiss mutations, view switching);
 * it reads the URL via `useSearchParams`, so it renders inside a Suspense
 * boundary per the App Router contract.
 */
export default function OpportunitiesPage() {
  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Browse roles discovered across your connected sources. Filter, sort, and save what matters."
      />
      <React.Suspense fallback={<ResultsSkeleton view="card" />}>
        <OpportunityExplorer />
      </React.Suspense>
    </>
  );
}
