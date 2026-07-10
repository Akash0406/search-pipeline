/**
 * Redaction helper. Structured logs must never carry secrets or PII
 * (design → Observability: "Secrets/PII are never logged"). This module walks
 * arbitrary values and masks any property whose key looks sensitive.
 */

/** Placeholder substituted for any redacted value. */
export const REDACTED = '[REDACTED]' as const;

/**
 * Default set of case-insensitive key fragments considered sensitive. A key is
 * redacted when its normalised form (lower-cased, non-alphanumerics stripped)
 * contains any of these fragments.
 */
export const DEFAULT_SENSITIVE_KEYS: readonly string[] = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'clientsecret',
  'privatekey',
  'credential',
  'sessionid',
  'setcookie',
  'ssn',
  'creditcard',
  'cardnumber',
  'cvv',
];

/** Options controlling {@link createRedactor}. */
export interface RedactOptions {
  /** Extra sensitive key fragments to add to the defaults. */
  readonly extraKeys?: readonly string[];
  /** Replace the default fragment list entirely instead of extending it. */
  readonly keys?: readonly string[];
  /** Maximum nesting depth to traverse before masking wholesale. */
  readonly maxDepth?: number;
}

/** A pure function that returns a redacted copy of its input. */
export type Redactor = <T>(value: T) => T;

const DEFAULT_MAX_DEPTH = 8;

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Build a redactor closed over a sensitive-key matcher. The returned function
 * is pure: it never mutates its argument and safely handles cyclic structures.
 */
export function createRedactor(options: RedactOptions = {}): Redactor {
  const fragments = (options.keys ?? DEFAULT_SENSITIVE_KEYS)
    .concat(options.extraKeys ?? [])
    .map(normaliseKey);
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  const isSensitive = (key: string): boolean => {
    const normalised = normaliseKey(key);
    return fragments.some((fragment) => normalised.includes(fragment));
  };

  const walk = (value: unknown, depth: number, seen: WeakSet<object>): unknown => {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (seen.has(value)) {
      return '[Circular]';
    }
    if (depth >= maxDepth) {
      return '[Truncated]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => walk(item, depth + 1, seen));
    }
    if (value instanceof Error) {
      // Summarise errors without leaking stacks or attached secret properties.
      return { name: value.name, message: value.message };
    }

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      result[key] = isSensitive(key) ? REDACTED : walk(source[key], depth + 1, seen);
    }
    return result;
  };

  return <T>(value: T): T => walk(value, 0, new WeakSet<object>()) as T;
}

/** Convenience one-shot redaction using the default sensitive-key set. */
export const redact: Redactor = createRedactor();
