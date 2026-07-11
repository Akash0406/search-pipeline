import type { MetadataRoute } from 'next';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Web app manifest (Req 2.5). Served at /manifest.webmanifest so the public
 * surface is installable as a PWA.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: 'Personal career-opportunity intelligence. Let the right opportunities find you.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fefdfb',
    theme_color: '#5b45e0',
    orientation: 'portrait-primary',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
