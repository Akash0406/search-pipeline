import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { ProfileForm } from '@/components/profiles/profile-form';

export const metadata: Metadata = {
  title: 'New role profile',
};

/**
 * Create a role profile (Req 11–16). The first profile a user creates becomes
 * active automatically (Req 10.4, enforced by the API).
 */
export default function NewProfilePage() {
  return (
    <>
      <PageHeader
        title="New role profile"
        description="Tell us the roles you want. You can fine-tune everything later — only a name is required."
      />
      <ProfileForm />
    </>
  );
}
