import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Copy,
  FileText,
  KanbanSquare,
  Radar,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@careerstack/ui';
import { Container, Section } from '@/components/marketing/section';
import { PageHero } from '@/components/marketing/page-hero';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Real-time discovery, smart deduplication, eligibility signals, watchlists, and more — with AI relevance, alerts, and application tracking on the roadmap.',
};

const AVAILABLE = [
  { icon: Radar, title: 'Real-time discovery', body: 'Polite, continuous fetching from official and public sources keeps your list fresh without you lifting a finger.' },
  { icon: Copy, title: 'Smart deduplication', body: 'The same role across multiple boards collapses into one canonical opportunity, with every source preserved for traceability.' },
  { icon: ShieldCheck, title: 'Eligibility signals', body: 'Surface work-rights and requirement mismatches early so you focus on roles you can actually take.' },
  { icon: CalendarDays, title: 'Events & deadlines', body: 'Keep closing dates and hiring events in view so nothing slips past you.' },
  { icon: Star, title: 'Watchlists', body: 'Follow companies you care about and see their new roles as they appear.' },
  { icon: ClipboardList, title: 'Operational analytics', body: 'Understand source health, freshness, and where your opportunities come from.' },
];

const ROADMAP = [
  { icon: Sparkles, title: 'AI relevance', body: 'Semantic ranking tuned to your profile and history.' },
  { icon: Bell, title: 'Smart alerts', body: 'Get notified the instant a strong match appears.' },
  { icon: KanbanSquare, title: 'Application tracking', body: 'A Kanban pipeline for every application.' },
  { icon: FileText, title: 'Resume tailoring', body: 'Draft targeted resumes and cover letters per role.' },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="A calm, powerful workspace for your search"
        description="Everything below either works today or is clearly labelled as planned. We don't ship vapor."
      />

      <Section>
        <Container className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Available today</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AVAILABLE.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="h-full">
                <CardContent className="space-y-3 p-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="bg-muted/30">
        <Container className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">On the roadmap</h2>
            <Badge variant="outline">Planned</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="h-full">
                <CardContent className="space-y-3 p-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-secondary/15 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button asChild>
            <Link href="/signin">Start free</Link>
          </Button>
        </Container>
      </Section>
    </>
  );
}
