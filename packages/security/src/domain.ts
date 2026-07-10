/**
 * Registrable-domain + domain-policy helpers.
 *
 * The rate limiter is keyed by *registrable domain* (eTLD+1) so that, e.g.,
 * `boards.greenhouse.io` and `api.greenhouse.io` share one budget (Req 27.1).
 * Domain allow/deny matching (Req 31.7) treats an entry as matching a host when
 * the host equals it or is a subdomain of it; the deny-list always wins.
 */

import { getDomain, parse as parseHost } from 'tldts';
import type { DomainPolicy } from './types.js';

/**
 * Registrable domain (eTLD+1) for a hostname, e.g. `api.greenhouse.io` →
 * `greenhouse.io`. Falls back to the lower-cased host when the public-suffix
 * lookup cannot determine one (e.g. an IP literal or intranet name).
 */
export function registrableDomain(host: string): string {
  const lower = host.trim().toLowerCase();
  const domain = getDomain(lower);
  return domain ?? lower;
}

/** True when `host` equals `entry` or is a subdomain of `entry`. */
function hostMatchesEntry(host: string, entry: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, '');
  const e = entry.trim().toLowerCase().replace(/^\.+/, '').replace(/\.$/, '');
  if (e.length === 0) {
    return false;
  }
  return h === e || h.endsWith(`.${e}`);
}

/**
 * Evaluate a domain allow/deny policy for a host. Deny beats allow (Req 31.7):
 * a host matching the deny-list is rejected even if it also matches the
 * allow-list. When an allow-list is present, only hosts matching it are
 * permitted; an empty/absent allow-list permits anything not denied.
 */
export function isDomainAllowed(host: string, policy: DomainPolicy | undefined): boolean {
  if (!policy) {
    return true;
  }
  const deny = policy.deny ?? [];
  if (deny.some((entry) => hostMatchesEntry(host, entry))) {
    return false;
  }
  const allow = policy.allow ?? [];
  if (allow.length === 0) {
    return true;
  }
  return allow.some((entry) => hostMatchesEntry(host, entry));
}

/**
 * True when a host is syntactically a public, ICANN-recognised domain (not an
 * IP literal, not a private/intranet-only name). Useful for connectors that
 * only accept first-party public sources.
 */
export function isPublicHost(host: string): boolean {
  const result = parseHost(host.trim().toLowerCase());
  return result.isIcann === true && result.domain !== null;
}
