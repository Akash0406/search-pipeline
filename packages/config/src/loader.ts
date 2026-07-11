/**
 * Typed configuration loader.
 *
 * `loadConfig` reads a plain environment record, maps flat env var names into
 * the grouped schema shape, validates it with Zod, and returns a fully typed
 * `Config`. Missing required values raise a `ConfigError` with a clear, grouped
 * message. `brandName` is special-cased: when unset it falls back to a default
 * and emits a configuration warning rather than failing (Req 1.1, 1.3).
 */
import { configSchema, DEFAULT_BRAND_NAME, type Config } from './schema.js';

/** A plain environment record such as `process.env`. */
export type Env = Record<string, string | undefined>;

/** Sink for non-fatal configuration warnings (defaults to `console.warn`). */
export type WarnFn = (message: string) => void;

export interface LoadConfigOptions {
  /** Environment source. Defaults to `process.env`. */
  env?: Env;
  /** Warning sink. Defaults to `console.warn`. */
  onWarn?: WarnFn;
}

/** Thrown when required configuration is missing or invalid. */
export class ConfigError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/** Treat empty/whitespace-only env values as absent. */
const present = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : undefined;
};

/**
 * Map flat env var names into the nested shape expected by `configSchema`.
 * Absent values are passed as `undefined` so schema defaults can apply.
 */
const toSchemaInput = (env: Env) => ({
  app: {
    brandName: present(env.BRAND_NAME),
    environment: present(env.NODE_ENV),
  },
  cors: {
    origins: present(env.CORS_ORIGINS),
  },
  fetch: {
    maxBytes: present(env.FETCH_MAX_BYTES),
    timeoutMs: present(env.FETCH_TIMEOUT_MS),
    maxRedirects: present(env.FETCH_MAX_REDIRECTS),
    userAgent: present(env.FETCH_USER_AGENT),
    allowedDomains: present(env.FETCH_ALLOWED_DOMAINS),
    deniedDomains: present(env.FETCH_DENIED_DOMAINS),
  },
  rateLimit: {
    perDomainMaxRequests: present(env.RATE_LIMIT_PER_DOMAIN_MAX_REQUESTS),
    windowMs: present(env.RATE_LIMIT_WINDOW_MS),
    maxRetries: present(env.RATE_LIMIT_MAX_RETRIES),
    backoffBaseMs: present(env.RATE_LIMIT_BACKOFF_BASE_MS),
  },
  retention: {
    rawRetentionDays: present(env.RAW_RETENTION_DAYS),
  },
  auth: {
    google: {
      clientId: present(env.GOOGLE_OAUTH_CLIENT_ID),
      clientSecret: present(env.GOOGLE_OAUTH_CLIENT_SECRET),
      redirectUri: present(env.GOOGLE_OAUTH_REDIRECT_URI),
    },
    magicLink: {
      tokenTtlMinutes: present(env.MAGIC_LINK_TTL_MINUTES),
    },
    session: {
      cookieName: present(env.SESSION_COOKIE_NAME),
      secret: present(env.SESSION_SECRET),
      ttlHours: present(env.SESSION_TTL_HOURS),
      cookieSecure: present(env.SESSION_COOKIE_SECURE),
      cookieSameSite: present(env.SESSION_COOKIE_SAME_SITE),
    },
  },
  db: {
    databaseUrl: present(env.DATABASE_URL),
  },
  redis: {
    redisUrl: present(env.REDIS_URL),
  },
  storage: {
    endpoint: present(env.S3_ENDPOINT),
    region: present(env.S3_REGION),
    bucket: present(env.S3_BUCKET),
    accessKeyId: present(env.S3_ACCESS_KEY_ID),
    secretAccessKey: present(env.S3_SECRET_ACCESS_KEY),
    forcePathStyle: present(env.S3_FORCE_PATH_STYLE),
  },
});

/**
 * Load and validate configuration from the environment.
 *
 * @throws {ConfigError} when required values are missing or invalid.
 */
export function loadConfig(options: LoadConfigOptions = {}): Config {
  const env = options.env ?? process.env;
  const warn = options.onWarn ?? ((message: string) => console.warn(message));

  // Req 1.3: brandName falls back to a default and records a warning (not an error).
  if (present(env.BRAND_NAME) === undefined) {
    warn(
      `[config] BRAND_NAME is not set; falling back to default brand name "${DEFAULT_BRAND_NAME}".`,
    );
  }

  const parsed = configSchema.safeParse(toSchemaInput(env));

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    });
    throw new ConfigError(issues);
  }

  return parsed.data;
}
