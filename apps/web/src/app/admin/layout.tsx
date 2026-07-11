import type { Metadata } from 'next';
import { AppShell } from '@/components/app/app-shell';

/** Admin surfaces are never indexed. Access is enforced server-side (Req 8). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
