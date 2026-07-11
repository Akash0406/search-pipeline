/**
 * Best-effort dependency probes for `GET /health/dependencies`.
 *
 * Each probe opens a SHORT-LIVED connection, performs one cheap operation, and
 * tears it down — the health endpoint must never keep pooled connections alive
 * or leak sockets. Probes are bounded by a small timeout so an unreachable
 * dependency cannot hang the endpoint. Any failure propagates as a rejected
 * promise, which the controller maps to a `down` status.
 */
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { StorageConfig } from '@careerstack/config';

/** Default per-probe timeout (ms). */
const PROBE_TIMEOUT_MS = 2000;

@Injectable()
export class DependencyProbe {
  /** PING Redis over a throwaway connection, then quit. */
  async pingRedis(redisUrl: string, timeoutMs: number = PROBE_TIMEOUT_MS): Promise<void> {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: timeoutMs,
      lazyConnect: true,
      // Do not spam reconnects during a health probe.
      retryStrategy: () => null,
    });
    try {
      await withTimeout(client.connect(), timeoutMs);
      await withTimeout(client.ping(), timeoutMs);
    } finally {
      client.disconnect();
    }
  }

  /** HEAD the configured bucket to confirm object storage is reachable. */
  async headBucket(storage: StorageConfig, timeoutMs: number = PROBE_TIMEOUT_MS): Promise<void> {
    const client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
    });
    try {
      await withTimeout(client.send(new HeadBucketCommand({ Bucket: storage.bucket })), timeoutMs);
    } finally {
      client.destroy();
    }
  }
}

/** Reject if `promise` does not settle within `timeoutMs`. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('probe timed out')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
