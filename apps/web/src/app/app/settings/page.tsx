import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@careerstack/ui';
import { PageHeader } from '@/components/app/page-header';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata: Metadata = {
  title: 'Settings',
};

const SECTIONS = [
  {
    href: '/app/settings/sessions',
    icon: ShieldCheck,
    title: 'Sessions & security',
    description: 'Review the devices signed in to your account and revoke access.',
  },
  {
    href: '/app/settings/privacy',
    icon: SlidersHorizontal,
    title: 'Privacy & data',
    description: 'Export your data, disconnect sources, or delete your account.',
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account, appearance, and privacy." />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Choose a light, dark, or system theme. Your choice is saved to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <ThemeToggle persist />
          <span className="text-sm text-muted-foreground">Theme</span>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <Card key={href} className="transition-shadow hover:shadow-md">
            <Link
              href={href}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CardHeader>
                <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <CardTitle className="flex items-center justify-between text-base">
                  {title}
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        ))}
      </div>
    </>
  );
}
