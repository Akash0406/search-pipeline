/**
 * Redis connection wiring for BullMQ and the shared rate limiter.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on its connection so blocking
 * commands (BRPOPLPUSH etc.) are not aborted. A single ioredis client is shared
 * by every Queue/Worker/QueueEvents instance; the rate limiter reuses the same
 * client for its atomic token-bucket Lua script.
 */

import { Redis, type RedisOptions } from 'ioredis';

/** Options applied to every BullMQ-facing ioredis connection. */
export const BULLMQ_REDIS_OPTIONS: RedisOptions = {
  // BullMQ mandates this for blocking operations.
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/**
 * Create the shared ioredis connection from the configured `REDIS_URL`.
 * The caller owns the connection and must `quit()` it on shutdown.
 */
export function createRedisConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, BULLMQ_REDIS_OPTIONS);
}
