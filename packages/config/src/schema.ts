/**
 * Zod schemas for CareerStack configuration.
 *
 * Every value the platform needs at runtime is validated here from a plain
 * environment record (`Record<string, string | undefined>`, e.g. `process.env`).
 * The schemas are grouped into typed sub-configs (app, fetch, rateLimit,
 * retention, auth, db, redis, storage) so consumers depend only on the slice
 * they need.
 *
 * This package is framework-agnostic (no NestJS / Next / Drizzle / ioredis) so
 * it can be shared by `apps/api`, `apps/worker`, and `apps/web`.
 */
import { z } from 'zod';

/** Default brand/display name used when `BRAND_NAME` is unset (Req 1.3). */
export const DEFAULT_BRAND_NAME = 'CareerStack' as const;

/** Hard upper bound on magic-link validity, mandated by Req 5.4 (≤ 15 minutes). */
export const MAGIC_LINK_MAX_TTL_MINUTES = 15 as const;

/** Coerce a required, non-empty string env var. */
const requiredString = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} must not be empty`);

/** Coerce an integer env var with sensible bounds. */
const intWithDefault = (defaultValue: number, opts: { min?: number; max?: number } = {}) => {
  let schema = z.coerce.number().int();
  if (opts.min !== undefined) schema = schema.min(opts.min);
  if (opts.max !== undefined) schema = schema.max(opts.max);
  return schema.default(defaultValue);
};

/** Parse a comma/space-separated list into a trimmed string array (empty → []). */
const csvList = z
  .string()
  .optional()
  .transform((raw) =>
    (raw ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

const booleanFlag = (defaultValue: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v === 'true' || v === '1'));

/**
 * Application-level configuration (Capability A).
 * `brandName` is handled specially by the loader so it can fall back to a
 * default and emit a warning instead of failing (Req 1.1, 1.3).
 */
export const appSchema = z.object({
  brandName: z.string().trim().min(1).default(DEFAULT_BRAND_NAME),
  environment: z.enum(['development', 'test', 'production']).default('development'),
});

/**
 * Safe-fetch bounds enforced by the SafeFetcher (Req 31.3, 31.4, 31.5).
 * `maxRedirects` (31.3), `maxBytes` (31.4), `timeoutMs` (31.5).
 */
export const fetchSchema = z.object({
  maxBytes: intWithDefault(5_000_000, { min: 1 }), // Req 31.4
  timeoutMs: intWithDefault(10_000, { min: 1 }), // Req 31.5
  maxRedirects: intWithDefault(5, { min: 0 }), // Req 31.3
  userAgent: z
    .string()
    .trim()
    .min(1)
    .default('CareerStackBot/1.0 (+https://careerstack.example/bot)'),
  allowedDomains: csvList, // domain allow-list (deny beats allow)
  deniedDomains: csvList, // domain deny-list
});

/**
 * Per-domain rate limiting (Req 27.1). A configurable request budget applied
 * per registrable domain across all connections targeting that domain.
 */
export const rateLimitSchema = z.object({
  perDomainMaxRequests: intWithDefault(5, { min: 1 }), // Req 27.1
  windowMs: intWithDefault(1_000, { min: 1 }),
  maxRetries: intWithDefault(5, { min: 0 }), // backoff attempts (Req 27.3)
  backoffBaseMs: intWithDefault(500, { min: 1 }),
});

/** Configurable raw-source retention policy (Req 53.1). */
export const retentionSchema = z.object({
  rawRetentionDays: intWithDefault(90, { min: 1 }), // Req 53.1
});

/**
 * Auth configuration (Capability B). OAuth client credentials and secrets are
 * read from the environment and never hardcoded. `magicLink.tokenTtlMinutes`
 * is capped at 15 minutes (Req 5.4).
 */
export const authSchema = z.object({
  google: z.object({
    clientId: requiredString('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: requiredString('GOOGLE_OAUTH_CLIENT_SECRET'),
    redirectUri: requiredString('GOOGLE_OAUTH_REDIRECT_URI').pipe(z.string().url()),
  }),
  magicLink: z.object({
    // Req 5.4: validity window must not exceed 15 minutes.
    tokenTtlMinutes: intWithDefault(MAGIC_LINK_MAX_TTL_MINUTES, {
      min: 1,
      max: MAGIC_LINK_MAX_TTL_MINUTES,
    }),
  }),
  session: z.object({
    cookieName: z.string().trim().min(1).default('cs_session'),
    secret: requiredString('SESSION_SECRET').pipe(z.string().min(32)),
    ttlHours: intWithDefault(720, { min: 1 }), // 30 days
    cookieSecure: booleanFlag(true),
    cookieSameSite: z.enum(['strict', 'lax', 'none']).default('lax'),
  }),
});

/** PostgreSQL connection (Req 32.1 substrate). */
export const dbSchema = z.object({
  databaseUrl: requiredString('DATABASE_URL').pipe(z.string().url()),
});

/** Redis connection used by BullMQ queues + the rate limiter. */
export const redisSchema = z.object({
  redisUrl: requiredString('REDIS_URL').pipe(z.string().url()),
});

/** S3 / MinIO object storage for Raw_Artifacts (Req 32.1). */
export const storageSchema = z.object({
  endpoint: requiredString('S3_ENDPOINT').pipe(z.string().url()),
  region: z.string().trim().min(1).default('us-east-1'),
  bucket: requiredString('S3_BUCKET'),
  accessKeyId: requiredString('S3_ACCESS_KEY_ID'),
  secretAccessKey: requiredString('S3_SECRET_ACCESS_KEY'),
  forcePathStyle: booleanFlag(true), // MinIO requires path-style addressing
});

/** The full, validated configuration object. */
export const configSchema = z.object({
  app: appSchema,
  fetch: fetchSchema,
  rateLimit: rateLimitSchema,
  retention: retentionSchema,
  auth: authSchema,
  db: dbSchema,
  redis: redisSchema,
  storage: storageSchema,
});

export type AppConfig = z.infer<typeof appSchema>;
export type FetchConfig = z.infer<typeof fetchSchema>;
export type RateLimitConfig = z.infer<typeof rateLimitSchema>;
export type RetentionConfig = z.infer<typeof retentionSchema>;
export type AuthConfig = z.infer<typeof authSchema>;
export type DbConfig = z.infer<typeof dbSchema>;
export type RedisConfig = z.infer<typeof redisSchema>;
export type StorageConfig = z.infer<typeof storageSchema>;
export type Config = z.infer<typeof configSchema>;
