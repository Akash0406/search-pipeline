import type { Metadata } from 'next';
import { UserCircle } from 'lucide-react';
import { Button } from '@careerstack/ui';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/common/states';

export const metadata: Metadata = {
  title: 'Role profiles',
};

/**
 * Role-profiles placeholder. The create/edit editor and activation flows are
 * built in a later task (6.x); the active-profile switcher in the shell already
 * reads from the same API. This route provides an accessible empty state.
 */
export default function ProfilesPage() {
  return (
    <>
      <PageHeader
        title="Role profiles"
        description="Named sets of preferences — titles, skills, locations — that focus your discovery. One is active at a time."
      />
      <EmptyState
        icon={UserCircle}
        title="No role profiles yet"
        description="Create your first role profile to tell us the roles you want. Your first profile becomes active automatically."
        action={<Button disabled>Create a role profile (coming soon)</Button>}
      />
    </>
  );
}
