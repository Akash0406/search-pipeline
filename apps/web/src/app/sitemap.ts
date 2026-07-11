import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

/** Public, indexable routes (Req 2.1, 2.2). */
const PUBLIC_ROUTES = [
  '',
  '/features',
  '/how-it-works',
  '/sources',
  '/security',
  '/privacy',
  '/terms',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.7,
  }));
}
