import type { Metadata } from 'next';
import { OpportunityDetailView } from '@/components/opportunities/opportunity-detail';

export const metadata: Metadata = {
  title: 'Opportunity',
};

/**
 * Opportunity detail route (Req 45). Ownership/visibility and per-user state are
 * resolved server-side by the API; the client view renders full detail, source
 * history with evidence, safe external links, and the reserved match/analysis
 * region. A missing/inaccessible id surfaces as a not-found state.
 */
export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpportunityDetailView id={id} />;
}
