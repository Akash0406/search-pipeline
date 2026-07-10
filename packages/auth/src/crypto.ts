/**
 * Node.js implementation of the {@link CryptoProvider} port.
 *
 * Uses only `node:crypto` — no third-party dependencies. Raw tokens are
 * generated with a CSPRNG and returned URL-safe; only their SHA-256 hash is
 * ever persisted (Req 5, Req 6). HMAC-SHA256 signs OAuth `state`.
 */
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual as nodeTimingSafeEqual,
} from 'node:crypto';
import type { CryptoProvider } from './ports.js';

/** Encode a buffer as URL-safe base64 (base64url, no padding). */
export function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

/** Default entropy for random tokens (32 bytes → 256 bits). */
export const DEFAULT_TOKEN_BYTES = 32;

export const nodeCryptoProvider: CryptoProvider = {
  randomToken(byteLength: number = DEFAULT_TOKEN_BYTES): string {
    return toBase64Url(randomBytes(byteLength));
  },

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  },

  hmac(message: string, secret: string): string {
    return createHmac('sha256', secret).update(message, 'utf8').digest('base64url');
  },

  sha256Base64Url(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('base64url');
  },

  timingSafeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    // `timingSafeEqual` throws on length mismatch; compare digests of equal
    // length instead so the comparison stays constant-time regardless of input.
    if (aBuf.length !== bBuf.length) {
      // Still perform a comparison to avoid an early-return timing signal.
      const filler = Buffer.alloc(aBuf.length);
      nodeTimingSafeEqual(aBuf, aBuf.length === filler.length ? filler : aBuf);
      return false;
    }
    return nodeTimingSafeEqual(aBuf, bBuf);
  },
};
