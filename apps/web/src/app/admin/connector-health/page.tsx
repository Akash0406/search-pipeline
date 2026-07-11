import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { ConnectorHealthClient } from '@/components/admin/connector-health-client';

export const metadata: Metadata = {
  title: 'Connector health',
};

/**
 * Admin connector-health surface (Req 47, 48). Admin access is gated by
 * middleware and enforced/audited server-side; the interactive, read-only view
 * (per-connection health, recent runs, parser failures, review queue) is a
 * client component so it can subscribe to live updates and handle a 403 from
 * the API gracefully.
 */
export default function ConnectorHealthPage() {
  return (
    <>
      <PageHeader
        title="Connector health"
        description="Operational view of source connectors, recent runs, parser failures, and the review queue."
      />
      <ConnectorHealthClient />
    </>
  );
}
