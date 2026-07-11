/*
 * CareerStack service worker — offline-fallback shell for the public surface
 * (Req 2.5). Hand-rolled (no build-step dependency) so the build stays green.
 *
 * Strategy:
 *  - Precache the offline fallback page and the manifest on install.
 *  - Navigation requests use network-first, falling back to a cached page (or
 *    the offline shell) when the network is unavailable.
 *  - Only GET requests are ever cached; API calls (/api/*) are never cached.
 */
const CACHE_VERSION = 'careerstack-shell-v1';
const OFFLINE_URL = '/offline';
const PRECACHE_URLS = [OFFLINE_URL, '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept API traffic or cross-origin requests.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch {
          const cache = await caches.open(CACHE_VERSION);
          const cached = await cache.match(request);
          return cached ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first with background refresh.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) cache.put(request, networkResponse.clone());
        return networkResponse;
      } catch {
        return cached ?? Response.error();
      }
    })(),
  );
});
