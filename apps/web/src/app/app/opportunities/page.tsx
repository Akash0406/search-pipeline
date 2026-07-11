import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Radar } from 'lucide-react';
import { Button } from '@careerstack/ui';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/common/states';

export const metadata: Metadata = {
  title: 'Opportunities',
};

/**
 * Explorer placeholder. The card/list/table explorer, filters, sort, and URL
 * state are built in a later task (11.x); this page provides the route and an
 * accessible empty state so the shell is fully navigable.
 */
export default function OpportunitiesPage() {
  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Browse roles discovered across your connected sources."
      />
      <EmptyState
        icon={Radar}
        title="No opportunities yet"
        description="Connect a source and set an active role profile — discovered opportunities will show up here to browse, filter, and save."
        action={
          <Button asChild>
            <Link href="/app/sources">
              <Building2 className="size-4" aria-hidden />
              Connect a source
            </Link>
          </Button>
        }
      />
    </>
  );
}
