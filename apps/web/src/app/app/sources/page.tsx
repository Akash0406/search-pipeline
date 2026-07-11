import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { Button } from '@careerstack/ui';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/common/states';

export const metadata: Metadata = {
  title: 'Sources',
};

/**
 * Sources/connections placeholder. Connection management, runs, and manual URL
 * submission are built in a later task; this route provides the empty state.
 */
export default function SourcesPage() {
  return (
    <>
      <PageHeader
        title="Sources"
        description="Company career pages and ATS boards you're tracking for new opportunities."
      />
      <EmptyState
        icon={Building2}
        title="No connected sources"
        description="Add a company's Greenhouse, Lever, or Ashby board — or a career-page URL — and we'll discover and keep opportunities up to date."
        action={<Button disabled>Add a source (coming soon)</Button>}
      />
    </>
  );
}
