/**
 * Generic network-shaped fast-check arbitraries: URLs, domains, and IP
 * addresses spanning the ranges the SSRF guard must block (Property 8 /
 * SEC-001) as well as safe public addresses for negative cases.
 *
 * These are deliberately dependency-free (no import of `packages/security` or
 * `packages/shared`) so the testing package stays a leaf. The full SSRF
 * rejection property test (task 7.7) targets the security package's guard using
 * {@link arbIpAddress}.
 */
import fc from 'fast-check';

/** An octet 0..255. */
const octet = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 255 });

const ipv4 = (parts: fc.Arbitrary<number>[]): fc.Arbitrary<string> =>
  fc.tuple(...parts).map((xs) => xs.join('.'));

/** A hex group 0..0xffff, rendered without leading zeros. */
const hextet = (): fc.Arbitrary<string> =>
  fc.integer({ min: 0, max: 0xffff }).map((n) => n.toString(16));

// ---------------------------------------------------------------------------
// Domains + URLs
// ---------------------------------------------------------------------------

/** A syntactically valid registrable domain name (e.g. `careers.example.com`). */
export function arbDomain(): fc.Arbitrary<string> {
  return fc.domain();
}

/** A well-formed absolute `http(s)` URL, optionally with query + fragment. */
export function arbUrl(): fc.Arbitrary<string> {
  return fc.webUrl({ withQueryParameters: true, withFragments: true });
}

/** A well-formed absolute `https` URL (scheme constrained to https). */
export function arbHttpsUrl(): fc.Arbitrary<string> {
  return fc
    .webUrl({ withQueryParameters: true, withFragments: true })
    .map((u) => u.replace(/^http:/, 'https:'));
}

// ---------------------------------------------------------------------------
// Blocked IPv4 ranges (must be rejected by the SSRF guard)
// ---------------------------------------------------------------------------

/** Loopback: `127.0.0.0/8`. */
export function arbLoopbackIpv4(): fc.Arbitrary<string> {
  return ipv4([fc.constant(127), octet(), octet(), octet()]);
}

/** RFC 1918 private ranges: `10/8`, `172.16/12`, `192.168/16`. */
export function arbPrivateIpv4(): fc.Arbitrary<string> {
  return fc.oneof(
    ipv4([fc.constant(10), octet(), octet(), octet()]),
    ipv4([fc.constant(172), fc.integer({ min: 16, max: 31 }), octet(), octet()]),
    ipv4([fc.constant(192), fc.constant(168), octet(), octet()]),
  );
}

/** Link-local: `169.254.0.0/16`. */
export function arbLinkLocalIpv4(): fc.Arbitrary<string> {
  return ipv4([fc.constant(169), fc.constant(254), octet(), octet()]);
}

/** Cloud metadata endpoint (IMDS): `169.254.169.254`. */
export function arbMetadataIpv4(): fc.Arbitrary<string> {
  return fc.constant('169.254.169.254');
}

/** Multicast: `224.0.0.0/4`. */
export function arbMulticastIpv4(): fc.Arbitrary<string> {
  return ipv4([fc.integer({ min: 224, max: 239 }), octet(), octet(), octet()]);
}

/**
 * Assorted reserved / special-use IPv4 ranges: "this network" (`0/8`), CGNAT
 * (`100.64/10`), TEST-NET blocks, benchmarking (`198.18/15`), future-use
 * (`240/4`), and limited broadcast (`255.255.255.255`).
 */
export function arbReservedIpv4(): fc.Arbitrary<string> {
  return fc.oneof(
    ipv4([fc.constant(0), octet(), octet(), octet()]),
    ipv4([fc.constant(100), fc.integer({ min: 64, max: 127 }), octet(), octet()]),
    ipv4([fc.constant(192), fc.constant(0), fc.constant(2), octet()]), // TEST-NET-1
    ipv4([fc.constant(198), fc.constant(51), fc.constant(100), octet()]), // TEST-NET-2
    ipv4([fc.constant(203), fc.constant(0), fc.constant(113), octet()]), // TEST-NET-3
    ipv4([fc.constant(198), fc.integer({ min: 18, max: 19 }), octet(), octet()]), // benchmarking
    ipv4([fc.integer({ min: 240, max: 255 }), octet(), octet(), octet()]), // future-use / broadcast
  );
}

// ---------------------------------------------------------------------------
// Blocked IPv6 ranges
// ---------------------------------------------------------------------------

/** IPv6 loopback: `::1`. */
export function arbLoopbackIpv6(): fc.Arbitrary<string> {
  return fc.constant('::1');
}

/** IPv6 unspecified: `::`. */
export function arbUnspecifiedIpv6(): fc.Arbitrary<string> {
  return fc.constant('::');
}

/** IPv6 link-local: `fe80::/10`. */
export function arbLinkLocalIpv6(): fc.Arbitrary<string> {
  return fc.array(hextet(), { minLength: 3, maxLength: 3 }).map((groups) => `fe80::${groups.join(':')}`);
}

/** IPv6 unique-local: `fc00::/7`. */
export function arbUniqueLocalIpv6(): fc.Arbitrary<string> {
  return fc.array(hextet(), { minLength: 3, maxLength: 3 }).map((groups) => `fd00::${groups.join(':')}`);
}

/** IPv6 cloud metadata endpoint: `fd00:ec2::254`. */
export function arbMetadataIpv6(): fc.Arbitrary<string> {
  return fc.constant('fd00:ec2::254');
}

// ---------------------------------------------------------------------------
// Composite arbitraries
// ---------------------------------------------------------------------------

/**
 * An IP address spanning **every blocked range** (IPv4 + IPv6) the SSRF guard
 * must reject: private, loopback, link-local, unique-local, multicast,
 * reserved, and cloud-metadata. Use this to drive the SSRF rejection property.
 */
export function arbIpAddress(): fc.Arbitrary<string> {
  return fc.oneof(
    arbLoopbackIpv4(),
    arbPrivateIpv4(),
    arbLinkLocalIpv4(),
    arbMetadataIpv4(),
    arbMulticastIpv4(),
    arbReservedIpv4(),
    arbLoopbackIpv6(),
    arbUnspecifiedIpv6(),
    arbLinkLocalIpv6(),
    arbUniqueLocalIpv6(),
    arbMetadataIpv6(),
  );
}

/**
 * A safe, routable public IPv4 address drawn from curated public sample blocks
 * (documentation resolvers and well-known public ranges) that fall outside
 * every blocked range. Useful for negative SSRF cases (should be allowed).
 */
export function arbPublicIpv4(): fc.Arbitrary<string> {
  return fc.oneof(
    ipv4([fc.constant(1), fc.constant(1), fc.constant(1), octet()]), // 1.1.1.0/24
    ipv4([fc.constant(8), fc.constant(8), fc.constant(8), octet()]), // 8.8.8.0/24
    ipv4([fc.constant(93), fc.constant(184), fc.constant(216), octet()]), // 93.184.216.0/24
    ipv4([fc.integer({ min: 20, max: 99 }), octet(), octet(), fc.integer({ min: 1, max: 254 })]),
  );
}
