import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/common/states';

export const metadata: Metadata = {
  title: 'Sessions',
};

/**
 * Sessions placeholder. The live session list + revoke controls are built in a
 * later task (4.4 / UI); this route provides the empty state within the shell.
 */
export default function SessionsPage() {
  return (
    <>
      <PageHeader
        title="Sessions & security"
        description="Devices currently signed in to your account. Revoke any you don't recognise."
      />
      <EmptyState
        icon={ShieldCheck}
        title="Session management is on the way"
        description="You'll be able to see each active session — device, approximate location, and last activity — and revoke them individually or all at once."
      />
    </>
  );
}
