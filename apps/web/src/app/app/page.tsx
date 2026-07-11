import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, Radar, UserCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@careerstack/ui';
import { PageHeader } from '@/components/app/page-header';

export const metadata: Metadata = {
  title: 'Home',
};

const QUICK_LINKS = [
  {
    href: '/app/profiles',
    icon: UserCircle,
    title: 'Set up a role profile',
    description: 'Tell us the titles, skills, and locations you care about so discovery is focused.',
  },
  {
    href: '/app/sources',
    icon: Building2,
    title: 'Connect a source',
    description: 'Add company career pages and ATS boards (Greenhouse, Lever, Ashby) to track.',
  },
  {
    href: '/app/opportunities',
    icon: Radar,
    title: 'Explore opportunities',
    description: 'Browse, filter, and sort discovered roles — then save the ones worth a look.',
  },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Welcome back"
        description="Get set up in three steps, then let the right opportunities find you."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map(({ href, icon: Icon, title, description }) => (
          <Card key={href} className="flex flex-col transition-shadow hover:shadow-md">
            <CardHeader>
              <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="ghost" size="sm" className="px-0 text-primary">
                <Link href={href}>
                  Get started
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Your activity</CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Demo
            </Badge>
          </div>
          <CardDescription>
            This panel is illustrative placeholder content. Real metrics appear once you connect a
            source and start tracking opportunities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Tracked sources', value: '0' },
              { label: 'Opportunities', value: '0' },
              { label: 'Saved', value: '0' },
              { label: 'Role profiles', value: '0' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border bg-card/50 p-4">
                <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
