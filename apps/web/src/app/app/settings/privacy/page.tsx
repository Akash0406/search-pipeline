import type { Metadata } from 'next';
import { SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/common/states';

export const metadata: Metadata = {
  title: 'Privacy & data',
};

/**
 * Privacy placeholder. Data export, source disconnect, and account deletion
 * flows are built in a later task (14.x); this route provides the empty state.
 */
export default function PrivacySettingsPage() {
  return (
    <>
      <PageHeader
        title="Privacy & data"
        description="Export your data, disconnect sources, or delete your account and data."
      />
      <EmptyState
        icon={SlidersHorizontal}
        title="Privacy controls are on the way"
        description="You'll be able to export everything we hold about you, disconnect sources while keeping opportunities accessible, and permanently delete your account."
      />
    </>
  );
}
