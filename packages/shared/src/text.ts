/**
 * Pure text-normalization helpers used by the normalization mapper and the
 * fuzzy-matching stage of deduplication (Design §3, §4).
 *
 * All functions are deterministic and side-effect free.
 */

/** Collapse all runs of whitespace to a single space and trim the ends. */
export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Strip parenthetical/bracketed segments (usually location or req-id noise)
 * from a title before further normalization, e.g. `"Engineer (Sydney)"`.
 */
function stripBracketed(input: string): string {
  return input.replace(/[([{][^)\]}]*[)\]}]/g, ' ');
}

/**
 * Normalize a job title into a stable comparison key (Design §3):
 *  - lower-cased;
 *  - bracketed/parenthetical noise removed;
 *  - punctuation/separators reduced to spaces (kept: `+` and `#` for stacks);
 *  - whitespace collapsed.
 *
 * The ORIGINAL title is preserved by the caller (Req 33.2); this returns only
 * the normalized comparison form.
 */
export function normalizeTitle(input: string): string {
  const lowered = stripBracketed(input.toLowerCase());
  const cleaned = lowered.replace(/[^a-z0-9+#]+/g, ' ');
  return collapseWhitespace(cleaned);
}

/** Common legal-entity suffixes stripped from a company comparison key. */
const COMPANY_SUFFIXES = new Set<string>([
  'inc',
  'incorporated',
  'llc',
  'llp',
  'ltd',
  'limited',
  'pty',
  'plc',
  'co',
  'corp',
  'corporation',
  'gmbh',
  'ag',
  'sa',
  'bv',
  'group',
  'holdings',
]);

/**
 * Normalize a company name into a stable comparison key:
 *  - lower-cased;
 *  - `&` expanded to `and`;
 *  - punctuation reduced to spaces;
 *  - trailing legal-entity suffix tokens removed;
 *  - whitespace collapsed.
 */
export function normalizeCompany(input: string): string {
  const lowered = input.toLowerCase().replace(/&/g, ' and ');
  const cleaned = collapseWhitespace(lowered.replace(/[^a-z0-9]+/g, ' '));
  if (cleaned.length === 0) return '';
  const tokens = cleaned.split(' ');
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1] as string;
    if (COMPANY_SUFFIXES.has(last)) {
      tokens.pop();
    } else {
      break;
    }
  }
  return tokens.join(' ');
}

/** Split a normalized string into a de-duplicated, sorted-stable token list. */
export function tokenize(input: string): string[] {
  if (input.length === 0) return [];
  return input.split(' ').filter((t) => t.length > 0);
}
