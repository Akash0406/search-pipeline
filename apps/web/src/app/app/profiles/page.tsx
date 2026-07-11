import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@careerstack/ui';
import { PageHeader } from '@/components/app/page-header';
import { ProfileList } from '@/components/profiles/profile-list';

export const metadata: Metadata = {
  title: 'Role profiles',
};

/**
 * Role-profiles surface (Req 10–19, Design §8 `/app/profiles`). The RSC shell
 * renders the header + create action; the client `ProfileList` handles data,
 * the required empty/loading/error states, and the lifecycle actions.
 */
export default function ProfilesPage() {
  return (
    <>
      <PageHeader
        title="Role profiles"
        description="Named sets of preferences — titles, skills, locations — that focus your discovery. One is active at a time."
        actions={
          <Button asChild>
            <Link href="/app/profiles/new">
              <Plus className="size-4" aria-hidden />
              New profile
            </Link>
          </Button>
        }
      />
      <ProfileList />
    </>
  );
}
