import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, Lock, ServerCog, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { Button, Card, CardContent } from '@careerstack/ui';
import { Container, Section } from '@/components/marketing/section';
import { PageHero } from '@/components/marketing/page-hero';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How CareerStack keeps your account and data safe: passwordless sign-in, OAuth where available, no third-party passwords, encryption, and full data control.',
};

const COMMITMENTS = [
  {
    icon: KeyRound,
    title: 'No job-platform password storage',
    body: `${BRAND_NAME} never requests, accepts, or stores passwords for LinkedIn, SEEK, Indeed, or any third-party platform.`,
  },
  {
    icon: UserCheck,
    title: 'OAuth where available',
    body: 'Sign in with Google using OAuth with the minimum scopes required, or use a single-use email magic link. No passwords to manage.',
  },
  {
    icon: ShieldCheck,
    title: 'Your approval, always',
    body: 'Nothing is sent or applied on your behalf. Auto-apply is a line we deliberately never cross.',
  },
  {
    icon: Lock,
    title: 'Encrypted private documents',
    body: 'Private documents and sensitive fields such as work-rights are treated as private to you and protected accordingly.',
  },
  {
    icon: ServerCog,
    title: 'Safe, polite fetching',
    body: 'Connectors run with SSRF protection, size and timeout limits, redirect caps, content-type checks, and per-domain rate limits.',
  },
  {
    icon: Trash2,
    title: 'Deletion & export',
    body: 'Export all of your data or permanently delete your account at any time, with explicit confirmation.',
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security & privacy"
        title="Built to earn your trust, by design"
        description="Security here isn't a feature bolted on later — the whole system is designed around not touching what it shouldn't."
      />
      <Section>
        <Container className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMMITMENTS.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="h-full">
                <CardContent className="space-y-3 p-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-success/12 text-success">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button asChild variant="outline">
              <Link href="/privacy">Read the privacy policy</Link>
            </Button>
            <Button asChild>
              <Link href="/signin">Get started</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
