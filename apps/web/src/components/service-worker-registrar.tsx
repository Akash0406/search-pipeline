'use client';

import { useEffect } from 'react';

/**
 * Registers the offline-shell service worker (Req 2.5). Registration is
 * production-only to avoid interfering with the dev server's HMR.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* Registration failures are non-fatal; the app still works online. */
      });
    };

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
