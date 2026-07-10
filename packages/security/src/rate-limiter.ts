/**
 * Per-domain rate limiter + backoff — Req 27.1, 27.2, 27.3; Design Security §2.
 *
 * A token bucket keyed by registrable domain, shared across all callers. When a
 * caller is over budget the limiter returns a `retryAfterMs` deferral rather
 * than dropping the request (Req 27.2). Two implementations are provided:
 *  - {@link InMemoryRateLimiter} — process-local, for tests and single-process
 *    use;
 *  - {@link RedisRateLimiter} — atomic (Lua) token bucket in Redis, shared
 *    across every worker/connection targeting a domain (Req 27.1).
 *
 * Exponential backoff with jitter ({@link computeBackoffMs}) is applied on
 * throttling / transient 5xx up to a configured maximum (Req 27.3).
 */

import type { Clock } from '@careerstack/observability';
import type { RateLimitConfig } from '@careerstack/config';
import { registrableDomain } from './domain.js';

/** Outcome of a rate-limit check. */
export interface RateLimitDecision {
  /** True when the request may proceed now. */
  allowed: boolean;
  /** When deferred, how long to wait before retrying (ms); 0 when allowed. */
  retryAfterMs: number;
  /** Registrable domain the decision was keyed on. */
  domain: string;
}

/** Token-bucket parameters derived from {@link RateLimitConfig}. */
export interface RateLimiterOptions {
  /** Bucket capacity / burst — maps to `perDomainMaxRequests`. */
  capacity: number;
  /** Length of the refill window in ms — maps to `windowMs`. */
  windowMs: number;
}

/** The rate-limiter contract used by {@link SafeFetcher}. */
export interface RateLimiter {
  /**
   * Attempt to consume one token for `host`'s registrable domain. Never
   * throws for over-budget; returns a deferral decision instead.
   */
  acquire(host: string): Promise<RateLimitDecision>;
}

/** Derive token-bucket options from the shared rate-limit config. */
export function rateLimiterOptionsFromConfig(config: RateLimitConfig): RateLimiterOptions {
  return { capacity: config.perDomainMaxRequests, windowMs: config.windowMs };
}

interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

/**
 * Process-local token bucket. The refill rate is `capacity` tokens per
 * `windowMs`; tokens accrue continuously so bursts up to `capacity` are
 * permitted while the long-run average never exceeds the configured rate.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly capacity: number;
  private readonly windowMs: number;
  private readonly ratePerMs: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions, clock?: Clock) {
    this.capacity = Math.max(1, options.capacity);
    this.windowMs = Math.max(1, options.windowMs);
    this.ratePerMs = this.capacity / this.windowMs;
    this.now = clock ? () => clock().getTime() : () => Date.now();
  }

  acquire(host: string): Promise<RateLimitDecision> {
    const domain = registrableDomain(host);
    const nowMs = this.now();
    const bucket = this.buckets.get(domain) ?? { tokens: this.capacity, lastRefillMs: nowMs };

    // Refill based on elapsed time, capped at capacity.
    const elapsed = Math.max(0, nowMs - bucket.lastRefillMs);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.ratePerMs);
    bucket.lastRefillMs = nowMs;

    let decision: RateLimitDecision;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      decision = { allowed: true, retryAfterMs: 0, domain };
    } else {
      const deficit = 1 - bucket.tokens;
      const retryAfterMs = Math.ceil(deficit / this.ratePerMs);
      decision = { allowed: false, retryAfterMs, domain };
    }

    this.buckets.set(domain, bucket);
    return Promise.resolve(decision);
  }
}

/** Minimal Redis surface used by {@link RedisRateLimiter} (ioredis satisfies it). */
export interface RedisEvalClient {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

/**
 * Atomic token bucket in Redis. State (`tokens`, `ts`) lives in a hash per
 * registrable domain and is updated by a single Lua script so concurrent
 * workers share one budget without races (Req 27.1). Keys carry a TTL so idle
 * domains are reclaimed automatically.
 */
export class RedisRateLimiter implements RateLimiter {
  private static readonly SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])      -- tokens per ms
local now = tonumber(ARGV[3])       -- ms
local ttl = tonumber(ARGV[4])       -- ms

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = now - ts
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + elapsed * rate)

local allowed = 0
local retry = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  retry = math.ceil((1 - tokens) / rate)
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, ttl)
return {allowed, retry}
`;

  private readonly capacity: number;
  private readonly windowMs: number;
  private readonly ratePerMs: number;
  private readonly ttlMs: number;
  private readonly keyPrefix: string;
  private readonly now: () => number;

  constructor(
    private readonly redis: RedisEvalClient,
    options: RateLimiterOptions,
    deps: { clock?: Clock; keyPrefix?: string } = {},
  ) {
    this.capacity = Math.max(1, options.capacity);
    this.windowMs = Math.max(1, options.windowMs);
    this.ratePerMs = this.capacity / this.windowMs;
    // Retain a bucket for a few windows past its last use, then let it expire.
    this.ttlMs = Math.max(this.windowMs * 10, 60_000);
    this.keyPrefix = deps.keyPrefix ?? 'ratelimit:domain:';
    this.now = deps.clock ? () => deps.clock!().getTime() : () => Date.now();
  }

  async acquire(host: string): Promise<RateLimitDecision> {
    const domain = registrableDomain(host);
    const key = `${this.keyPrefix}${domain}`;
    const result = (await this.redis.eval(
      RedisRateLimiter.SCRIPT,
      1,
      key,
      this.capacity,
      this.ratePerMs,
      this.now(),
      this.ttlMs,
    )) as [number, number];

    const allowed = Number(result[0]) === 1;
    const retryAfterMs = Number(result[1]) || 0;
    return { allowed, retryAfterMs, domain };
  }
}

/** Options for {@link computeBackoffMs}. */
export interface BackoffOptions {
  /** Base delay for attempt 1 (ms). */
  baseMs: number;
  /** Upper bound on the delay (ms). */
  maxMs?: number;
  /** Full-jitter fraction in [0,1]; 1 = full jitter (default), 0 = none. */
  jitter?: number;
  /**
   * Random source in [0,1) — injectable for deterministic tests. Defaults to
   * `Math.random`.
   */
  random?: () => number;
}

/**
 * Exponential backoff with jitter for retry attempt `attempt` (1-based).
 * Delay grows as `baseMs * 2^(attempt-1)`, is clamped to `maxMs`, then has
 * jitter applied. Used on throttling / transient 5xx up to a max (Req 27.3).
 */
export function computeBackoffMs(attempt: number, options: BackoffOptions): number {
  const n = Math.max(1, Math.floor(attempt));
  const base = Math.max(0, options.baseMs);
  const maxMs = options.maxMs ?? base * 2 ** 10;
  const jitter = Math.min(1, Math.max(0, options.jitter ?? 1));
  const random = options.random ?? Math.random;

  const exponential = Math.min(maxMs, base * 2 ** (n - 1));
  // Full-jitter: sample uniformly in [exponential*(1-jitter), exponential].
  const floor = exponential * (1 - jitter);
  const delay = floor + random() * (exponential - floor);
  return Math.round(delay);
}
