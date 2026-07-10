/**
 * Australia-focused location parsing (Design §3). Pure + deterministic.
 *
 * Parses a free-text location into a {@link StructuredLocation}
 * `{ city, region, country, isRemote }` using a small AU gazetteer with
 * international fallbacks. Never fabricates: unknown parts stay `undefined`.
 */

import { collapseWhitespace } from './text.js';
import type { StructuredLocation } from './types.js';

/** AU state/territory canonical codes keyed by common spellings/abbreviations. */
const AU_REGIONS: Record<string, string> = {
  nsw: 'NSW',
  'new south wales': 'NSW',
  vic: 'VIC',
  victoria: 'VIC',
  qld: 'QLD',
  queensland: 'QLD',
  wa: 'WA',
  'western australia': 'WA',
  sa: 'SA',
  'south australia': 'SA',
  tas: 'TAS',
  tasmania: 'TAS',
  act: 'ACT',
  'australian capital territory': 'ACT',
  nt: 'NT',
  'northern territory': 'NT',
};

/** Major AU cities → their state/territory (also proves country = AU). */
const AU_CITIES: Record<string, string> = {
  sydney: 'NSW',
  newcastle: 'NSW',
  wollongong: 'NSW',
  'central coast': 'NSW',
  melbourne: 'VIC',
  geelong: 'VIC',
  ballarat: 'VIC',
  brisbane: 'QLD',
  'gold coast': 'QLD',
  'sunshine coast': 'QLD',
  cairns: 'QLD',
  townsville: 'QLD',
  perth: 'WA',
  adelaide: 'SA',
  hobart: 'TAS',
  launceston: 'TAS',
  canberra: 'ACT',
  darwin: 'NT',
};

/** Country-name/abbreviation fallbacks → ISO-3166 alpha-2. */
const COUNTRIES: Record<string, string> = {
  australia: 'AU',
  au: 'AU',
  aus: 'AU',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  us: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  'new zealand': 'NZ',
  nz: 'NZ',
  singapore: 'SG',
  sg: 'SG',
  india: 'IN',
  canada: 'CA',
  ireland: 'IE',
  germany: 'DE',
  'united arab emirates': 'AE',
  uae: 'AE',
};

const REMOTE_HINTS = ['remote', 'anywhere', 'work from home', 'wfh', 'distributed'];

function part(raw: string): string {
  return collapseWhitespace(raw.toLowerCase());
}

/** True when the location text denotes remote/anywhere work. */
export function looksRemote(text: string): boolean {
  const lower = text.toLowerCase();
  return REMOTE_HINTS.some((hint) => lower.includes(hint));
}

/**
 * Parse one free-text location string. `remoteOverride` forces `isRemote`
 * (e.g. when the work-arrangement fact already resolved to `remote`).
 */
export function parseLocation(
  raw: string,
  remoteOverride = false,
): StructuredLocation {
  const isRemote = remoteOverride || looksRemote(raw);
  const segments = raw
    .split(/[,/|]/)
    .map((s) => part(s))
    .filter((s) => s.length > 0 && !REMOTE_HINTS.includes(s));

  let city: string | undefined;
  let region: string | undefined;
  let country: string | undefined;

  for (const seg of segments) {
    if (!country && COUNTRIES[seg]) {
      country = COUNTRIES[seg];
      continue;
    }
    if (!region && AU_REGIONS[seg]) {
      region = AU_REGIONS[seg];
      country ??= 'AU';
      continue;
    }
    if (!city && AU_CITIES[seg]) {
      city = titleCase(seg);
      region ??= AU_CITIES[seg];
      country ??= 'AU';
      continue;
    }
    // First unrecognised free-text segment becomes the city (best-effort).
    if (!city) {
      city = titleCase(seg);
    }
  }

  const result: StructuredLocation = { raw: collapseWhitespace(raw), isRemote };
  if (city !== undefined) result.city = city;
  if (region !== undefined) result.region = region;
  if (country !== undefined) result.country = country;
  return result;
}

function titleCase(input: string): string {
  return input
    .split(' ')
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Build the stable location key used by the fingerprint and fuzzy proximity:
 * `city|region|country|remote`, lower-cased. An empty set of locations yields
 * `remote` when remote, else the empty string.
 */
export function locationKey(
  locations: readonly StructuredLocation[],
  isRemote: boolean,
): string {
  const primary = locations[0];
  if (!primary) return isRemote ? 'remote' : '';
  const remoteFlag = primary.isRemote || isRemote ? 'remote' : '';
  return [
    (primary.city ?? '').toLowerCase(),
    (primary.region ?? '').toLowerCase(),
    (primary.country ?? '').toLowerCase(),
    remoteFlag,
  ].join('|');
}
