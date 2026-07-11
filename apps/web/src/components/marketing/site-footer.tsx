import Link from 'next/link';
import { Container } from './section';
import { BrandMark } from './brand-mark';
import { BRAND_NAME } from '@/lib/brand';

const FOOTER_SECTIONS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Sources', href: '/sources' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { label: 'Security', href: '/security' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Sign in', href: '/signin' },
      { label: 'Start free', href: '/signin' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <BrandMark className="text-lg" />
            <p className="max-w-xs text-sm text-muted-foreground">
              Personal career-opportunity intelligence. The right opportunities find you.
            </p>
          </div>
          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title} className="space-y-3">
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={`${section.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND_NAME}. Australia-focused. Built for job seekers.
          </p>
          <p>No auto-apply. No third-party passwords. Your data, your control.</p>
        </div>
      </Container>
    </footer>
  );
}
