import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { EditProfileClient } from '@/components/profiles/edit-profile-client';

export const metadata: Metadata = {
  title: 'Edit role profile',
};

/**
 * Edit a role profile (Req 19.1). Ownership is enforced server-side; a foreign
 * or missing id surfaces as a not-found state (Req 19.4).
 */
export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        title="Edit role profile"
        description="Update the roles, skills, and preferences that focus your discovery."
      />
      <EditProfileClient id={id} />
    </>
  );
}
