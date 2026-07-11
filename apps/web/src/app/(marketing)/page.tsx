import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  Copy,
  FileText,
  GraduationCap,
  KanbanSquare,
  Layers,
  Link2,
  Lock,
  Mail,
  Radar,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@careerstack/ui';
import { Container, Section, SectionHeading } from '@/components/marketing/section';
import { DemoOpportunityCard } from '@/components/marketing/demo-opportunity-card';
import { Faq } from '@/components/marketing/faq';
import { BRAND_NAME } from '@/lib/brand';

const SOURCES = [
  { icon: Building2, title: 'Company career pages', note: 'JSON-LD & public listings' },
  { icon: Layers, title: 'Public ATS feeds', note: 'Greenhouse, Lever, Ashby' },
  { icon: Mail, title: 'Job-alert emails', note: 'Future source' },
  { icon: GraduationCap, title: 'University events', note: 'Campus & grad programs' },
  { icon: Users, title: 'Networking', note: 'Meetups & referrals' },
  { icon: Radar, title: 'Professional communities', note: 'Curated feeds' },
  { icon: Link2, title: 'User-saved URLs', note: 'Paste any posting' },
];

const STEPS = [
  {
    title: 'Tell us your direction',
    body: 'Create a role profile: target titles, skills, locations, work arrangement, and optional work-rights.',
  },
  {
    title: 'Connect your sources',
    body: 'Add company boards and career pages. We fetch from official, public feeds — never with your passwords.',
  },
  {
    title: 'We discover & dedupe',
    body: 'Opportunities are fetched, normalized into one canonical shape, and de-duplicated across sources.',
  },
  {
    title: 'You browse & decide',
    body: 'Filter, sort, save, and dismiss. The right roles surface first — no more tab-hopping.',
  },
];

const FEATURES = [
  {
    icon: Radar,
    title: 'Real-time discovery',
    body: 'Continuous, polite fetching from official sources keeps your list fresh.',
    span: 'lg:col-span-2',
  },
  {
    icon: Sparkles,
    title: 'AI relevance',
    body: 'Semantic ranking tuned to your profile.',
    future: true,
  },
  {
    icon: ShieldCheck,
    title: 'Eligibility blockers',
    body: 'See work-rights and requirement mismatches up front.',
  },
  {
    icon: CalendarDays,
    title: 'Events & programs',
    body: 'Grad intakes, hiring events, and deadlines in one view.',
  },
  {
    icon: Copy,
    title: 'Smart deduplication',
    body: 'One canonical role, even when it appears on five boards.',
  },
  {
    icon: KanbanSquare,
    title: 'Application Kanban',
    body: 'Track every application through your pipeline.',
    future: true,
  },
  {
    icon: FileText,
    title: 'Resume tailoring',
    body: 'Draft targeted resumes per role.',
    future: true,
  },
  {
    icon: Star,
    title: 'Watchlists',
    body: 'Follow companies and get notified when they post.',
  },
  {
    icon: Bell,
    title: 'Smart alerts',
    body: 'Get pinged the moment a match appears.',
    future: true,
  },
  {
    icon: ClipboardList,
    title: 'Analytics',
    body: 'Understand your search: sources, freshness, and outcomes.',
    span: 'lg:col-span-2',
  },
];

const PRIVACY_POINTS = [
  'No job-platform password storage',
  'OAuth where available',
  'Your approval before sending or applying',
  'Encrypted private documents',
  'Account deletion & data export, any time',
];

export default function LandingPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <Section className="relative overflow-hidden pt-14 sm:pt-20" ariaLabelledby="hero-heading">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-primary/10 via-secondary/5 to-transparent"
        />
        <Container className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-6">
            <Badge variant="muted" className="w-fit gap-1.5 py-1">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              Australia-focused · Passwordless
            </Badge>
            <h1
              id="hero-heading"
              className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            >
              Stop searching everywhere.{' '}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Let the right opportunities find you.
              </span>
            </h1>
            <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              {BRAND_NAME} discovers roles from company career pages, public ATS feeds, and more —
              then normalizes and de-duplicates them into one focused, browsable list.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signin">
                  Start free <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              No credit card. No third-party passwords. Cancel anytime.
            </p>
          </div>

          {/* Product visual: a tasteful mock built from the design system. */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/20 to-secondary/20 blur-2xl"
            />
            <Card className="overflow-hidden shadow-xl">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
                <span className="size-2.5 rounded-full bg-destructive/60" aria-hidden />
                <span className="size-2.5 rounded-full bg-warning/70" aria-hidden />
                <span className="size-2.5 rounded-full bg-success/70" aria-hidden />
                <span className="ml-2 text-xs text-muted-foreground">
                  {BRAND_NAME} · Opportunities
                </span>
              </div>
              <CardContent className="space-y-3 p-4">
                <DemoOpportunityCard compact />
                <DemoOpportunityCard
                  compact
                  title="Platform Engineer"
                  company="Atlassian"
                  location="Sydney · Hybrid"
                  status="Active"
                />
                <DemoOpportunityCard
                  compact
                  title="Data Scientist"
                  company="Canva"
                  location="Remote (AU)"
                  status="Closing soon"
                />
              </CardContent>
            </Card>
          </div>
        </Container>
      </Section>

      {/* ------------------------------------------------------- Source network */}
      <Section id="sources" className="bg-muted/30" ariaLabelledby="sources-heading">
        <Container className="space-y-12">
          <SectionHeading
            id="sources-heading"
            eyebrow="One radar, every source"
            title="Your opportunities, gathered from where they actually live"
            description="We connect to first-party and public sources so you don't have to check a dozen sites a day."
          />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {SOURCES.map(({ icon: Icon, title, note }) => (
              <li key={title}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-2 p-5">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-medium">{title}</span>
                    <span className="text-sm text-muted-foreground">{note}</span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* -------------------------------------------------------------- Problem */}
      <Section ariaLabelledby="problem-heading">
        <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            id="problem-heading"
            align="start"
            eyebrow="The problem"
            title="The modern job hunt is a tab-hopping, deadline-missing mess"
            description="Roles are scattered across ATS boards, company pages, and inboxes. The same job shows up five times. Great opportunities close before you even see them."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['12+ places to check', 'Boards, career pages, alerts, and communities.'],
              ['Endless duplicates', 'The same role, reposted everywhere.'],
              ['Missed deadlines', 'Roles close before you notice them.'],
              ['No single view', 'Nowhere to compare and decide calmly.'],
            ].map(([title, body]) => (
              <Card key={title}>
                <CardContent className="space-y-1 p-5">
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* --------------------------------------------------------- How it works */}
      <Section id="how" className="bg-muted/30" ariaLabelledby="how-heading">
        <Container className="space-y-12">
          <SectionHeading
            id="how-heading"
            eyebrow="How it works"
            title="From scattered to focused in four steps"
          />
          <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <Card className="h-full">
                  <CardContent className="space-y-3 p-6">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <p className="font-semibold">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* --------------------------------------------------------- Feature bento */}
      <Section id="features" ariaLabelledby="features-heading">
        <Container className="space-y-12">
          <SectionHeading
            id="features-heading"
            eyebrow="Everything in one place"
            title="A calm, powerful workspace for your search"
            description="Items marked “Planned” are on the roadmap and clearly labelled — we only ship what actually works today."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body, future, span }) => (
              <Card key={title} className={`h-full ${span ?? ''}`}>
                <CardContent className="flex h-full flex-col gap-3 p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-secondary/15 text-secondary-foreground">
                      <Icon className="size-5 text-primary" aria-hidden />
                    </span>
                    {future ? (
                      <Badge variant="outline" className="text-xs">
                        Planned
                      </Badge>
                    ) : null}
                  </div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* ------------------------------------------------- Privacy & security */}
      <Section id="privacy" className="bg-muted/30" ariaLabelledby="privacy-heading">
        <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            id="privacy-heading"
            align="start"
            eyebrow="Privacy & security"
            title="Built to earn your trust, by design"
            description="We never ask for your passwords to LinkedIn, SEEK, or Indeed. Discovery uses OAuth and official public feeds only."
          />
          <ul className="space-y-3">
            {PRIVACY_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <Lock className="size-3.5" aria-hidden />
                </span>
                <span className="text-sm">{point}</span>
              </li>
            ))}
            <li className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/security">Read our security overview</Link>
              </Button>
            </li>
          </ul>
        </Container>
      </Section>

      {/* --------------------------------------------------------- Demo preview */}
      <Section ariaLabelledby="demo-heading">
        <Container className="space-y-8">
          <SectionHeading
            id="demo-heading"
            eyebrow="A peek inside"
            title="This is what an opportunity looks like"
            description="Every fact links back to its source. Here's a preview using demonstration data."
          />
          <div className="mx-auto max-w-2xl">
            <DemoOpportunityCard />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Illustrative example — demonstration data, not a live listing.
            </p>
          </div>
        </Container>
      </Section>

      {/* ------------------------------------------------------------------ FAQ */}
      <Section id="faq" className="bg-muted/30" ariaLabelledby="faq-heading">
        <Container className="space-y-10">
          <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions, answered" />
          <div className="mx-auto max-w-3xl">
            <Faq />
          </div>
        </Container>
      </Section>

      {/* ------------------------------------------------------------ Final CTA */}
      <Section ariaLabelledby="cta-heading">
        <Container>
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
            <CardContent className="flex flex-col items-center gap-6 px-6 py-14 text-center">
              <h2
                id="cta-heading"
                className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Let the right opportunities find you
              </h2>
              <p className="max-w-xl text-muted-foreground">
                Set up your first role profile in minutes. {BRAND_NAME} takes it from there.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signin">
                    Start free <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/signin">Sign in</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Container>
      </Section>
    </>
  );
}
