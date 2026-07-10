/**
 * SSRF guard (pure policy over resolved addresses) — Req 30.1, 30.2, 30.3;
 * Design Security §2.
 *
 * This module contains **no network access**. It classifies IP literals and
 * decides whether a resolved host is safe to fetch. The {@link SafeFetcher}
 * performs the DNS resolution and pins the connection to a validated address;
 * this guard is the pure decision function it (and every redirect hop) calls.
 *
 * Blocked ranges (rejected):
 *  - IPv4: `0.0.0.0/8`, `10/8`, `100.64/10` (CGNAT), `127/8` (loopback),
 *    `169.254/16` (link-local incl. `169.254.169.254` metadata), `172.16/12`,
 *    `192.0.0/24`, `192.0.2/24`, `192.168/16`, `198.18/15`, `198.51.100/24`,
 *    `203.0.113/24`, `224/4` (multicast), `240/4` (reserved),
 *    `255.255.255.255` (broadcast).
 *  - IPv6: `::/128` (unspecified), `::1` (loopback), `fc00::/7` (unique-local
 *    incl. the `fd00:ec2::254` metadata address), `fe80::/10` (link-local),
 *    `ff00::/8` (multicast), `2001:db8::/32` (documentation), plus any
 *    IPv4-mapped/embedded address whose IPv4 part is itself blocked.
 */

import { SsrfBlockedError } from './errors.js';

/** Well-known cloud metadata endpoints, blocked explicitly for clarity. */
export const CLOUD_METADATA_ADDRESSES: readonly string[] = [
  '169.254.169.254', // AWS/GCP/Azure IMDS
  'fd00:ec2::254', // AWS IPv6 IMDS
  '100.100.100.200', // Alibaba Cloud
];

/** Parse a dotted-quad IPv4 string into four octets, or `null` if invalid. */
function parseIpv4(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const n = Number(part);
    if (n > 255) {
      return null;
    }
    octets.push(n);
  }
  return [octets[0]!, octets[1]!, octets[2]!, octets[3]!];
}

/** True when `[a,b,c,d]` falls inside `network/prefix`. */
function ipv4InCidr(
  octets: [number, number, number, number],
  network: [number, number, number, number],
  prefix: number,
): boolean {
  const toInt = (o: [number, number, number, number]): number =>
    ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (toInt(octets) & mask) === (toInt(network) & mask);
}

const BLOCKED_IPV4_CIDRS: [network: [number, number, number, number], prefix: number][] = [
  [[0, 0, 0, 0], 8], // "this" network / unspecified
  [[10, 0, 0, 0], 8], // private
  [[100, 64, 0, 0], 10], // CGNAT
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link-local (incl. 169.254.169.254 metadata)
  [[172, 16, 0, 0], 12], // private
  [[192, 0, 0, 0], 24], // IETF protocol assignments
  [[192, 0, 2, 0], 24], // TEST-NET-1
  [[192, 168, 0, 0], 16], // private
  [[198, 18, 0, 0], 15], // benchmarking
  [[198, 51, 100, 0], 24], // TEST-NET-2
  [[203, 0, 113, 0], 24], // TEST-NET-3
  [[224, 0, 0, 0], 4], // multicast
  [[240, 0, 0, 0], 4], // reserved (incl. 255.255.255.255 broadcast)
];

function isBlockedIpv4(octets: [number, number, number, number]): boolean {
  return BLOCKED_IPV4_CIDRS.some(([network, prefix]) => ipv4InCidr(octets, network, prefix));
}

/**
 * Expand an IPv6 literal into its 16 bytes, resolving `::` compression and any
 * trailing embedded IPv4 (`::ffff:1.2.3.4`). Returns `null` when invalid.
 */
function parseIpv6(ip: string): Uint8Array | null {
  let text = ip;
  // Strip a zone id (e.g. `fe80::1%eth0`).
  const zone = text.indexOf('%');
  if (zone !== -1) {
    text = text.slice(0, zone);
  }
  if (!text.includes(':')) {
    return null;
  }

  const halves = text.split('::');
  if (halves.length > 2) {
    return null;
  }

  const expandSide = (side: string): number[] | null => {
    if (side.length === 0) {
      return [];
    }
    const groups = side.split(':');
    const out: number[] = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]!;
      // Embedded IPv4 only allowed in the final group.
      if (group.includes('.')) {
        if (i !== groups.length - 1) {
          return null;
        }
        const v4 = parseIpv4(group);
        if (!v4) {
          return null;
        }
        out.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
        continue;
      }
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
        return null;
      }
      out.push(parseInt(group, 16));
    }
    return out;
  };

  let head: number[] | null;
  let tail: number[] | null;
  if (halves.length === 2) {
    head = expandSide(halves[0]!);
    tail = expandSide(halves[1]!);
    if (head === null || tail === null) {
      return null;
    }
    const missing = 8 - (head.length + tail.length);
    if (missing < 0) {
      return null;
    }
    head = [...head, ...new Array<number>(missing).fill(0), ...tail];
    tail = [];
  } else {
    head = expandSide(text);
    if (head === null) {
      return null;
    }
  }

  const hextets = head;
  if (hextets.length !== 8) {
    return null;
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const value = hextets[i]!;
    if (value < 0 || value > 0xffff) {
      return null;
    }
    bytes[i * 2] = (value >> 8) & 0xff;
    bytes[i * 2 + 1] = value & 0xff;
  }
  return bytes;
}

function isBlockedIpv6(bytes: Uint8Array): boolean {
  const b = bytes;
  // Unspecified (::) and loopback (::1).
  const allZeroExceptLast = b.slice(0, 15).every((x) => x === 0);
  if (allZeroExceptLast && (b[15] === 0 || b[15] === 1)) {
    return true;
  }
  // Unique-local fc00::/7 (incl. fd00:ec2::254 metadata).
  if ((b[0]! & 0xfe) === 0xfc) {
    return true;
  }
  // Link-local fe80::/10.
  if (b[0] === 0xfe && (b[1]! & 0xc0) === 0x80) {
    return true;
  }
  // Multicast ff00::/8.
  if (b[0] === 0xff) {
    return true;
  }
  // Documentation 2001:db8::/32.
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) {
    return true;
  }
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d — validate the
  // embedded IPv4 against the IPv4 policy.
  const first10Zero = b.slice(0, 10).every((x) => x === 0);
  const isMapped = first10Zero && b[10] === 0xff && b[11] === 0xff;
  const isCompat = first10Zero && b[10] === 0 && b[11] === 0;
  if (isMapped || isCompat) {
    const embedded: [number, number, number, number] = [b[12]!, b[13]!, b[14]!, b[15]!];
    // ::0.0.0.0 / ::1 handled above; otherwise defer to the IPv4 policy.
    return isBlockedIpv4(embedded);
  }
  return false;
}

/**
 * Return `true` when `ip` (an IPv4 or IPv6 literal) is one the fetcher must
 * never connect to. Unparseable input is treated as blocked (fail closed).
 */
export function isBlockedIp(ip: string): boolean {
  const trimmed = ip.trim();
  const v4 = parseIpv4(trimmed);
  if (v4) {
    return isBlockedIpv4(v4);
  }
  const v6 = parseIpv6(trimmed);
  if (v6) {
    return isBlockedIpv6(v6);
  }
  // Not a valid IP literal → fail closed.
  return true;
}

/**
 * Assert a single resolved address is safe to connect to.
 *
 * @throws {SsrfBlockedError} when the address is blocked.
 */
export function assertSafeAddress(ip: string, host?: string): void {
  if (isBlockedIp(ip)) {
    throw new SsrfBlockedError(
      `Refusing to connect to blocked address ${ip}${host ? ` (host "${host}")` : ''}.`,
      { ip, ...(host !== undefined ? { host } : {}) },
    );
  }
}

/**
 * Validate every resolved IP for a host. If the host resolves to *any* blocked
 * address the whole host is rejected (defence against split-horizon / rebinding
 * tricks). Returns the validated IPs so the caller can pin the connection.
 *
 * @throws {SsrfBlockedError} when the host has no IPs or any IP is blocked.
 */
export function validateResolvedHost(host: string, ips: readonly string[]): string[] {
  if (ips.length === 0) {
    throw new SsrfBlockedError(`Host "${host}" did not resolve to any address.`, { host });
  }
  for (const ip of ips) {
    assertSafeAddress(ip, host);
  }
  return [...ips];
}
