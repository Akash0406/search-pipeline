/**
 * Pure string/location similarity used by the fuzzy dedup stage (Design §4).
 * All functions are deterministic and symmetric: `f(a, b) === f(b, a)`.
 */

import { tokenize } from './text.js';

/** Jaro similarity in [0, 1]. */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0 || bLen === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(aLen, bLen) / 2) - 1);
  const aMatches = new Array<boolean>(aLen).fill(false);
  const bMatches = new Array<boolean>(bLen).fill(false);

  let matches = 0;
  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, bLen);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  // Count transpositions.
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (
    (matches / aLen + matches / bLen + (matches - transpositions) / matches) / 3
  );
}

/**
 * Jaro-Winkler similarity in [0, 1] with the standard prefix boost
 * (`p = 0.1`, up to 4 leading chars).
 */
export function jaroWinkler(a: string, b: string): number {
  const base = jaro(a, b);
  if (base === 0) return 0;
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return base + prefix * 0.1 * (1 - base);
}

/** Jaccard token-set similarity in [0, 1]. */
export function tokenSetSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Combined title similarity: max of Jaro-Winkler and token-set Jaccard. */
export function titleSimilarity(a: string, b: string): number {
  return Math.max(jaroWinkler(a, b), tokenSetSimilarity(a, b));
}

/** Company similarity: exact-normalized == 1, else Jaro-Winkler. */
export function companySimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a === b) return 1;
  return jaroWinkler(a, b);
}

/**
 * Location proximity in [0, 1] over the stable location keys
 * (`city|region|country|remote`):
 *  - identical keys → 1;
 *  - both remote → 1;
 *  - same city (+ region) → 0.9;
 *  - same region → 0.7;
 *  - same country → 0.5;
 *  - one side unknown/empty → 0.5 (neutral, don't penalise missing data);
 *  - otherwise → 0.
 */
export function locationProximity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0.5;

  const [cityA = '', regionA = '', countryA = '', remoteA = ''] = a.split('|');
  const [cityB = '', regionB = '', countryB = '', remoteB = ''] = b.split('|');

  if (remoteA === 'remote' && remoteB === 'remote') return 1;
  if (cityA && cityA === cityB) return 0.9;
  if (regionA && regionA === regionB) return 0.7;
  if (countryA && countryA === countryB) return 0.5;
  return 0;
}
