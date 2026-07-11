/**
 * `@careerstack/config` — typed, validated configuration loader.
 *
 * Framework-agnostic: consumed by `apps/api`, `apps/worker`, and `apps/web`.
 * It reads environment variables, validates them with Zod, and exposes a fully
 * typed configuration object grouped into sub-configs (app, fetch, rateLimit,
 * retention, auth, db, redis, storage).
 *
 * Usage:
 * ```ts
 * import { loadConfig } from '@careerstack/config';
 * const config = loadConfig(); // reads process.env, throws ConfigError if invalid
 * console.log(config.app.brandName);
 * ```
 */
export const CONFIG_PACKAGE = '@careerstack/config' as const;

export {
  loadConfig,
  ConfigError,
  type Env,
  type WarnFn,
  type LoadConfigOptions,
} from './loader.js';

export {
  DEFAULT_BRAND_NAME,
  MAGIC_LINK_MAX_TTL_MINUTES,
  configSchema,
  appSchema,
  corsSchema,
  DEFAULT_WEB_ORIGIN,
  fetchSchema,
  rateLimitSchema,
  retentionSchema,
  authSchema,
  dbSchema,
  redisSchema,
  storageSchema,
  type Config,
  type AppConfig,
  type CorsConfig,
  type FetchConfig,
  type RateLimitConfig,
  type RetentionConfig,
  type AuthConfig,
  type DbConfig,
  type RedisConfig,
  type StorageConfig,
} from './schema.js';
