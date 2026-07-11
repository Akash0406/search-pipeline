import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, GraduationCap, Layers, Link2, Mail, Radar, Users } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@careerstack/ui';
import { Container, Section } from '@/components/marketing/section';
import { PageHero } from '@/components/marketing/page-hero';

export const metadata: Metadata = {
  title: 'Sources',
  description:
    'CareerStack connects to first-party and public sources — company career pages, public ATS feeds, and any URL you paste — never using third-party passwords.',
};

const LIVE = [
  {
    icon: Layers,
    title: 'Public ATS feeds',
    body: 'Greenhouse, Lever, and Ashby public job boards, classified as first-party sources.',
  },
  {
    icon: Building2,
    title: 'Company career pages',
    body: 'Pages publishing schema.org JobPosting JSON-LD are parsed directly from the source.',
  },
  {
    icon: Link2,
    title: 'Manual URL submission',
    body: 'Paste any job posting URL and we fetch and parse it under the same safety controls.',
  },
];

const PLANNED = [
  { icon: Mail, title: 'Job-alert emails' },
  { icon: GraduationCap, title: 'University events' },
  { icon: Users, title: 'Networking & communities' },
  { icon: Radar, title: 'Professional community feeds' },
];

export default function SourcesPage() {
  return (
    <>
      <PageHero
        eyebrow="Sources"
        title="Opportunities from where they actually live"
        description="We prefer first-party sources — the hiring company or its official ATS — so what you see is accurate and traceable."
      />

      <Section>
        <Container className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Available today</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {LIVE.map(({ icon: Icon, title, body }) => (
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
            <h2 className="text-2xl font-semibold tracking-tight">Planned source types</h2>
            <Badge variant="outline">Roadmap</Badge>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {PLANNED.map(({ icon: Icon, title }) => (
              <li key={title}>
                <Card className="h-full">
                  <CardContent className="flex flex-col gap-2 p-5">
                    <Icon className="size-5 text-primary" aria-hidden />
                    <span className="text-sm font-medium">{title}</span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <p className="max-w-2xl text-sm text-muted-foreground">
            We never bypass CAPTCHAs, rate limits, anti-bot measures, or authentication, and we
            never scrape private, logged-in content.
          </p>
          <Button asChild>
            <Link href="/signin">Connect a source</Link>
          </Button>
        </Container>
      </Section>
    </>
  );
}
