import type { Metadata } from 'next';
import { Dashboard } from '@/components/app/dashboard';

export const metadata: Metadata = {
  title: 'Home',
};

/**
 * Authenticated dashboard (Req 2, 3, Design §8 `/app`). The client `Dashboard`
 * pulls real data (user, sources, opportunities) via TanStack Query with full
 * loading/empty/error states; future-slice metrics are shown as clearly
 * labelled "coming soon" affordances rather than fabricated numbers.
 */
export default function DashboardPage() {
  return <Dashboard />;
}
