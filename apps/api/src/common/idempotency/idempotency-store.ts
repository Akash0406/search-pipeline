/**
 * Idempotency store (Design API §7 — `Idempotency-Key` handling for POST
 * mutations).
 *
 * Records the FIRST completed response for a given `(userId, method, path,
 * Idempotency-Key)` tuple for a short window so that a retried/duplicate request
 * with the same key returns the stored response instead of executing the
 * mutation twice. A replay whose request-body fingerprint differs from the
 * original is a client error (`CONFLICT`, Design error table) and is surfaced by
 * the interceptor.
 *
 * The default implementation is an in-memory, TTL-bounded map. It is process
 * local (adequate for a single API instance / tests); a Redis-backed
 * implementation can be swapped in behind the same interface without touching
 * call sites. Entries progress through two states:
 *   - `in_flight` — the first request is still executing (reserved slot).
 *   - `completed` — the response has been captured and can be replayed.
 */

/** A captured response ready to be replayed to a duplicate request. */
export interface StoredIdempotentResponse {
  statusCode: number;
  body: unknown;
}

/** An in-flight reservation: the first request has not completed yet. */
export interface InFlightRecord {
  state: 'in_flight';
  fingerprint: string;
  createdAt: number;
}

/** A completed record: the first response is captured for replay. */
export interface CompletedRecord {
  state: 'completed';
  fingerprint: string;
  createdAt: number;
  response: StoredIdempotentResponse;
}

export type IdempotencyRecord = InFlightRecord | CompletedRecord;

/** Store contract; implementations may be in-memory or Redis-backed. */
export interface IdempotencyStore {
  /**
   * Attempt to reserve `key` for a new request identified by `fingerprint`.
   * Returns the existing record when one is present (so the caller can replay a
   * completed response or detect an in-flight/mismatched replay); returns
   * `undefined` when the slot was freshly reserved for this request.
   */
  reserve(key: string, fingerprint: string): IdempotencyRecord | undefined;
  /** Capture the completed response for a previously reserved key. */
  complete(key: string, response: StoredIdempotentResponse): void;
  /** Release a reservation (e.g. the first request failed) so retries proceed. */
  release(key: string): void;
}

/** Default in-memory TTL for a captured idempotent response (10 minutes). */
export const DEFAULT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

/**
 * Process-local, TTL-bounded {@link IdempotencyStore}. Expired entries are
 * pruned lazily on access, so no background timer is required.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, IdempotencyRecord>();

  constructor(
    private readonly ttlMs: number = DEFAULT_IDEMPOTENCY_TTL_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  reserve(key: string, fingerprint: string): IdempotencyRecord | undefined {
    this.prune();
    const existing = this.entries.get(key);
    if (existing) return existing;
    this.entries.set(key, {
      state: 'in_flight',
      fingerprint,
      createdAt: this.now(),
    });
    return undefined;
  }

  complete(key: string, response: StoredIdempotentResponse): void {
    const existing = this.entries.get(key);
    if (!existing) return;
    this.entries.set(key, {
      state: 'completed',
      fingerprint: existing.fingerprint,
      createdAt: this.now(),
      response,
    });
  }

  release(key: string): void {
    this.entries.delete(key);
  }

  /** Drop entries whose TTL has elapsed. */
  private prune(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [key, record] of this.entries) {
      if (record.createdAt < cutoff) this.entries.delete(key);
    }
  }
}
