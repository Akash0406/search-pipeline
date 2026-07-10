/**
 * Raw_Artifact object storage over an S3-compatible backend (MinIO in dev,
 * S3 in prod) — Req 32.1. Bodies are written here BEFORE parsing and their
 * `storageKey` is recorded on `raw_artifacts`; retention-cleanup deletes the
 * object when the artifact passes its retention window (Req 53.2).
 *
 * Uses the AWS SDK v3 S3 client with path-style addressing (MinIO requires it).
 * The client is constructed eagerly from config but performs no network I/O
 * until a command runs, so bootstrap never blocks on a live bucket.
 */

import { createHash } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { StorageConfig } from '@careerstack/config';

/** A stored object's coordinates + integrity hash. */
export interface StoredArtifact {
  storageKey: string;
  contentHash: string;
  byteSize: number;
}

/** Port the pipeline depends on (kept narrow for testability). */
export interface ArtifactStore {
  put(input: {
    connectionId: string;
    sourceUrl: string;
    body: Buffer;
    contentType?: string;
  }): Promise<StoredArtifact>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  contentHash(body: Buffer): string;
}

/** sha256 hex of a buffer, used for change-detection + fetch idempotency. */
function sha256Hex(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

/**
 * Build a stable, content-addressed storage key. The content hash in the key
 * makes re-storing an identical body a no-op overwrite (idempotent, Req 32).
 */
function buildStorageKey(connectionId: string, contentHash: string): string {
  const shard = contentHash.slice(0, 2);
  return `raw-artifacts/${connectionId}/${shard}/${contentHash}`;
}

/** Concatenate a web/Node stream body into a Buffer. */
async function collectBody(body: unknown): Promise<Buffer> {
  if (body === undefined || body === null) return Buffer.alloc(0);
  // Node.js Readable (the SDK returns this in Node runtimes).
  if (typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (body instanceof Uint8Array) return Buffer.from(body);
  throw new Error('Unsupported S3 body stream type');
}

/** S3/MinIO-backed implementation of {@link ArtifactStore}. */
export class S3ArtifactStore implements ArtifactStore {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  contentHash(body: Buffer): string {
    return sha256Hex(body);
  }

  async put(input: {
    connectionId: string;
    sourceUrl: string;
    body: Buffer;
    contentType?: string;
  }): Promise<StoredArtifact> {
    const contentHash = sha256Hex(input.body);
    const storageKey = buildStorageKey(input.connectionId, contentHash);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: input.body,
        ...(input.contentType ? { ContentType: input.contentType } : {}),
        Metadata: { 'source-url': encodeURIComponent(input.sourceUrl) },
      }),
    );
    return { storageKey, contentHash, byteSize: input.body.byteLength };
  }

  async get(storageKey: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
    return collectBody(result.Body);
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }
}
