import type { Metadata } from 'next';
import { Activity } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/common/states';

export const metadata: Metadata = {
  title: 'Connector health',
};

/**
 * Admin connector-health placeholder (Req 47, 48). The live per-connection
 * health, run history, parser failures, and review queue are built in a later
 * task (13.x). Admin access itself is guarded and audited server-side.
 */
export default function ConnectorHealthPage() {
  return (
    <>
      <PageHeader
        title="Connector health"
        description="Operational view of source connectors, recent runs, parser failures, and the review queue."
      />
      <EmptyState
        icon={Activity}
        title="No connector data yet"
        description="Once connectors start running, this admin view surfaces per-connection health, recent run counts and failure reasons, parser failures, and items awaiting review."
      />
    </>
  );
}
