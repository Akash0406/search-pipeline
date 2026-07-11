/**
 * Signed-URL issuance for export bundles (Design Security §7, Req 49.2).
 *
 * Export bundles are stored privately in object storage by the worker. This
 * service issues a SHORT-LIVED presigned GET URL for a bundle's storage key.
 * The caller (PrivacyController → ExportService) performs the ownership check
 * before asking for a URL, so a URL is only ever produced for the OWNER of the
 * export (Req 49.2).
 */
import { Inject, Injectable } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Config } from '@careerstack/config';
import { CONFIG } from '../common/di-tokens.js';

/** Default signed-URL validity — deliberately short (5 minutes). */
const DEFAULT_EXPIRES_SECONDS = 300;

@Injectable()
export class ExportStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(CONFIG) config: Config) {
    this.bucket = config.storage.bucket;
    this.client = new S3Client({
      endpoint: config.storage.endpoint,
      region: config.storage.region,
      forcePathStyle: config.storage.forcePathStyle,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
    });
  }

  /** Issue a short-lived signed download URL for a stored export bundle. */
  async signedDownloadUrl(
    storageKey: string,
    expiresInSeconds: number = DEFAULT_EXPIRES_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: storageKey });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
