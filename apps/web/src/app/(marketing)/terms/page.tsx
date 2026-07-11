import type { Metadata } from 'next';
import { Container, Section } from '@/components/marketing/section';
import { PageHero, Prose } from '@/components/marketing/page-hero';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Terms',
  description: `The terms that govern your use of ${BRAND_NAME}.`,
};

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Terms of service"
        title="The basics of using the service"
        description="A plain-language overview of the terms. This is provided for transparency and is not legal advice."
      />
      <Section>
        <Container>
          <Prose>
            <h2>Using {BRAND_NAME}</h2>
            <p>
              {BRAND_NAME} helps you discover and organize career opportunities from public and
              first-party sources. You&apos;re responsible for how you use the information it
              surfaces, including reviewing and submitting any applications yourself.
            </p>

            <h2>What the service does not do</h2>
            <ul>
              <li>It does not apply to jobs on your behalf.</li>
              <li>It does not guarantee employment, interviews, or any specific outcome.</li>
              <li>It does not access private, logged-in content on other platforms.</li>
            </ul>

            <h2>Your account</h2>
            <p>
              Keep your sign-in method secure. You can review active sessions, revoke them, and
              delete your account at any time. You must be able to form a binding agreement to use
              the service.
            </p>

            <h2>Acceptable use</h2>
            <p>
              Don&apos;t use the service to break the law, infringe others&apos; rights, or attempt
              to disrupt the platform or the sources it connects to.
            </p>

            <h2>Availability</h2>
            <p>
              The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
              Source availability and freshness depend on third-party systems outside our control.
            </p>

            <h2>Changes</h2>
            <p>
              We may update these terms as the product evolves. Material changes will be
              communicated through the app.
            </p>
          </Prose>
        </Container>
      </Section>
    </>
  );
}
