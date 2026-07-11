import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Card, CardContent } from '@careerstack/ui';
import { Container, Section } from '@/components/marketing/section';
import { PageHero } from '@/components/marketing/page-hero';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Create a role profile, connect official sources, and let CareerStack discover, normalize, and de-duplicate opportunities into one focused list.',
};

const STEPS = [
  {
    title: 'Tell us your direction',
    body: 'Create a role profile with target and excluded titles, required and preferred skills, locations, work arrangement, employment type, and seniority. Salary and work-rights are optional and private.',
  },
  {
    title: 'Connect your sources',
    body: 'Add company career pages and public ATS boards (Greenhouse, Lever, Ashby), or paste a single job URL. We fetch only from official, public feeds — never using your passwords.',
  },
  {
    title: 'We fetch, safely',
    body: 'Every fetch is bounded and polite: size and time limits, redirect caps, content-type checks, per-domain rate limits, and protection against reaching private infrastructure.',
  },
  {
    title: 'Normalize & de-duplicate',
    body: 'Each posting is mapped into one canonical shape with evidence for every fact. The same role across multiple boards collapses into a single opportunity, preferring first-party sources.',
  },
  {
    title: 'You browse & decide',
    body: 'Filter, sort, save, and dismiss in a fast explorer. Open the original posting in one click. You stay in control — nothing is ever applied on your behalf.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="From scattered to focused"
        description={`${BRAND_NAME} does the gathering so you can do the deciding.`}
      />
      <Section>
        <Container>
          <ol className="space-y-6">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <Card>
                  <CardContent className="flex gap-5 p-6">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">{step.title}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Button asChild size="lg">
              <Link href="/signin">Create your first profile</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
