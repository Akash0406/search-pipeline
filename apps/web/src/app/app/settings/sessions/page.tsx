import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { SessionsClient } from '@/components/settings/sessions-client';

export const metadata: Metadata = {
  title: 'Sessions',
};

/**
 * Sessions & security settings (Req 6). Lists active sessions with device,
 * approximate location, and last activity, and lets the user revoke sessions
 * individually or sign out everywhere else.
 */
export default function SessionsPage() {
  return (
    <>
      <PageHeader
        title="Sessions & security"
        description="Devices currently signed in to your account. Revoke any you don’t recognise."
      />
      <SessionsClient />
    </>
  );
}
