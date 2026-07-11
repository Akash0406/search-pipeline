import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { PrivacyClient } from '@/components/privacy/privacy-client';

export const metadata: Metadata = {
  title: 'Privacy & data',
};

/**
 * Privacy & data-control settings (Req 49–53). Export your data, disconnect
 * sources (opportunities stay accessible), review the retention policy, and
 * delete specific data or your whole account. All destructive actions require
 * explicit confirmation; long-running work (export) shows live status.
 */
export default function PrivacySettingsPage() {
  return (
    <>
      <PageHeader
        title="Privacy & data"
        description="Export your data, disconnect sources, review retention, or delete your account and data."
      />
      <PrivacyClient />
    </>
  );
}
