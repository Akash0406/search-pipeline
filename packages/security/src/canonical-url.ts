/**
 * Canonical URL normalizer (pure) — Req 36.1, Design Normalization §3.
 *
 * `canonicalizeUrl` produces a stable string used as an identity key for
 * deduplication. It is a pure function (no network, no clock) and is
 * **idempotent**: `canonicalizeUrl(canonicalizeUrl(u)) === canonicalizeUrl(u)`.
 *
 * Normalization steps:
 *  - lower-case the scheme and host;
 *  - drop the fragment (`#…`);
 *  - remove the default port (`:80` for http, `:443` for https);
 *  - strip well-known tracking/analytics query params (utm_*, gclid, fbclid, …);
 *  - sort the remaining query params (key then value) for order-independence;
 *  - remove a trailing slash from the path (except the root `/`);
 *  - re-encode consistently via the WHATWG URL parser.
 */

import { InvalidUrlError } from './errors.js';

/** Schemes we canonicalize. Anything else is rejected as a non-web identity. */
const CANONICAL_SCHEMES = new Set(['http:', 'https:']);

/**
 * Exact tracking/analytics parameter names removed during canonicalization.
 * Kept lower-cased; matching is case-insensitive.
 */
const TRACKING_PARAMS = new Set<string>([
  'gclid',
  'gclsrc',
  'dclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'igsh',
  'yclid',
  'twclid',
  'ttclid',
  'li_fat_id',
  'wickedid',
  'vero_id',
  'vero_conv',
  'oly_anon_id',
  'oly_enc_id',
  's_cid',
  'mkt_tok',
  '_hsenc',
  '_hsmi',
  'hsctatracking',
  '_ga',
  '_gl',
  'ref',
  'ref_src',
  'ref_url',
  'referrer',
  'source',
  'spm',
  'scm',
  'trk',
  'trkcampaign',
  'cmpid',
  'campaignid',
  'adgroupid',
  'adid',
]);

/** Prefixes whose entire family of params are tracking noise (e.g. `utm_*`). */
const TRACKING_PREFIXES = ['utm_', 'pk_', 'piwik_', 'matomo_', 'hsa_'];

/** Default ports removed from the canonical host. */
const DEFAULT_PORTS: Record<string, string> = {
  'http:': '80',
  'https:': '443',
};

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  if (TRACKING_PARAMS.has(lower)) {
    return true;
  }
  return TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Canonicalize a URL into a stable identity key.
 *
 * @throws {InvalidUrlError} when the input cannot be parsed or is not http(s).
 */
export function canonicalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new InvalidUrlError(`Cannot canonicalize malformed URL: "${input}".`);
  }

  // WHATWG URL already lower-cases scheme + host for special schemes; enforce
  // the http(s) restriction so non-web schemes never become identity keys.
  const scheme = url.protocol.toLowerCase();
  if (!CANONICAL_SCHEMES.has(scheme)) {
    throw new InvalidUrlError(`Unsupported scheme for canonical URL: "${url.protocol}".`);
  }

  const host = url.hostname.toLowerCase();

  // Remove default port; keep any non-default port.
  const port = url.port && url.port !== DEFAULT_PORTS[scheme] ? `:${url.port}` : '';

  // Normalize the path: collapse a trailing slash except for the bare root.
  let path = url.pathname;
  if (path.length > 1) {
    path = path.replace(/\/+$/, '');
    if (path.length === 0) {
      path = '/';
    }
  }

  // Strip tracking params, then sort the survivors for order-independence.
  const params: [string, string][] = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (!isTrackingParam(key)) {
      params.push([key, value]);
    }
  }
  params.sort((a, b) =>
    a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1,
  );

  const sortedSearch = new URLSearchParams(params).toString();
  const search = sortedSearch.length > 0 ? `?${sortedSearch}` : '';

  // Fragment is intentionally dropped.
  return `${scheme}//${host}${port}${path}${search}`;
}
