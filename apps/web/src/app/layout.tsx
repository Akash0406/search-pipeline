import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';
import { BRAND_NAME } from '@/lib/brand';

const APP_DESCRIPTION =
  'Stop searching everywhere. CareerStack discovers relevant roles from company career pages, ATS feeds, and more — so the right opportunities find you.';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} — Let the right opportunities find you`,
    template: `%s · ${BRAND_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: BRAND_NAME,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: BRAND_NAME,
  },
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} — Let the right opportunities find you`,
    description: APP_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND_NAME} — Let the right opportunities find you`,
    description: APP_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fefdfb' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1f2e' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/* Skip link for keyboard/AT users (Req 57.2). */}
        <a
          href="#main-content"
          className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
