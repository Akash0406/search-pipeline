import type { Metadata } from 'next';
import { Container, Section } from '@/components/marketing/section';
import { PageHero, Prose } from '@/components/marketing/page-hero';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Privacy',
  description: `How ${BRAND_NAME} collects, uses, and protects your data — and the control you have over it.`,
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="Your data, your control"
        description="A plain-language summary of how we handle your information. This overview is provided for transparency and is not legal advice."
      />
      <Section>
        <Container>
          <Prose>
            <h2>What we collect</h2>
            <p>
              We collect the information you provide to run your search: your account identity (via
              Google OAuth or email magic link), your role profiles, the sources you connect, and
              your saved or dismissed opportunities. Optional fields such as salary and work-rights
              are exactly that — optional.
            </p>

            <h2>What we never collect</h2>
            <ul>
              <li>Passwords for third-party platforms (LinkedIn, SEEK, Indeed, and the like).</li>
              <li>Private, logged-in content behind another service&apos;s authentication.</li>
              <li>Your immigration status or work rights inferred from nationality or location.</li>
            </ul>

            <h2>How we use it</h2>
            <p>
              Your data is used to discover, organize, and present relevant opportunities to you. We
              do not sell your personal data. Sensitive fields like work-rights are treated as
              private to you.
            </p>

            <h2>How discovery works</h2>
            <p>
              {BRAND_NAME} acquires opportunity data only via OAuth, official and public ATS feeds,
              public career pages, JSON-LD, and URLs you submit. Fetching is bounded and polite, and
              we never bypass CAPTCHAs, rate limits, anti-bot measures, or authentication.
            </p>

            <h2>Retention</h2>
            <p>
              Raw fetched content is retained only for a configurable window to keep extraction
              auditable, then removed or anonymized. De-duplicated opportunities remain available
              even after their raw artifacts age out.
            </p>

            <h2>Your rights</h2>
            <ul>
              <li>Export all of your data at any time.</li>
              <li>Delete your account, which removes or irreversibly anonymizes your data.</li>
              <li>Disconnect a source without losing previously discovered opportunities.</li>
              <li>View and revoke your active sessions.</li>
            </ul>

            <h2>Contact</h2>
            <p>
              Questions about privacy? Reach us through the in-app support channel once you&apos;re
              signed in.
            </p>
          </Prose>
        </Container>
      </Section>
    </>
  );
}
