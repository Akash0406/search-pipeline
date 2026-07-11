/**
 * Idempotency interceptor (Design API §7 — `Idempotency-Key` handling for POST
 * mutations, `CONFLICT` on replay mismatch).
 *
 * Reusable, applied globally. It activates ONLY when a client sends an
 * `Idempotency-Key` header on a mutating request (POST/PUT/PATCH/DELETE); all
 * other requests pass straight through, so read paths and un-keyed mutations are
 * unaffected.
 *
 * Dedup key: `(userId, method, path, Idempotency-Key)`. On the first request the
 * slot is reserved, the handler runs, and its response is captured briefly. A
 * duplicate request with the same key:
 *   - replays the captured response when the original has completed;
 *   - is rejected with `409 CONFLICT` when the original is still in flight, or
 *     when the request-body fingerprint differs from the original (key reuse
 *     with a different payload — Design error table).
 *
 * The store is pluggable ({@link IdempotencyStore}); the default is in-memory.
 */
import {
  ConflictException,
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IDEMPOTENCY_STORE } from '../di-tokens.js';
import type { AuthenticatedRequest } from '../request-context.js';
import type { IdempotencyStore, StoredIdempotentResponse } from './idempotency-store.js';

/** Canonical header carrying the client-chosen idempotency key. */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method.toUpperCase();
    if (!MUTATING_METHODS.has(method)) return next.handle();

    const rawKey = request.headers[IDEMPOTENCY_KEY_HEADER];
    const idempotencyKey = (Array.isArray(rawKey) ? rawKey[0] : rawKey)?.trim();
    if (!idempotencyKey) return next.handle();

    const userId = request.authUser?.id ?? 'anonymous';
    const path = request.url.split('?')[0] ?? request.url;
    const dedupKey = `${userId}:${method}:${path}:${idempotencyKey}`;
    const fingerprint = fingerprintBody(request.body);

    const existing = this.store.reserve(dedupKey, fingerprint);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency-Key was reused with a different request payload.');
      }
      if (existing.state === 'in_flight') {
        throw new ConflictException(
          'A request with this Idempotency-Key is already being processed.',
        );
      }
      // Completed: replay the captured response verbatim.
      const reply = context.switchToHttp().getResponse<FastifyReply>();
      void reply.status(existing.response.statusCode);
      return of(existing.response.body);
    }

    const reply = context.switchToHttp().getResponse<FastifyReply>();
    return next.handle().pipe(
      tap({
        next: (body: unknown) => {
          const captured: StoredIdempotentResponse = {
            statusCode: reply.statusCode ?? 200,
            body,
          };
          this.store.complete(dedupKey, captured);
        },
        error: () => {
          // Free the slot so a genuine retry can proceed after a failure.
          this.store.release(dedupKey);
        },
      }),
    );
  }
}

/** Stable fingerprint of a request body for replay-mismatch detection. */
function fingerprintBody(body: unknown): string {
  if (body === undefined || body === null) return 'empty';
  const serialized = stableStringify(body);
  return createHash('sha256').update(serialized).digest('hex');
}

/** Deterministic JSON stringify with sorted object keys. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}
