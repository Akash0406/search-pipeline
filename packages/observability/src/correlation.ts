/**
 * Correlation-id propagation. A single correlation id (and optional trace/
 * request ids) must travel with a logical operation from the originating API
 * request or scheduler tick, through the queue, into the worker
 * (design → Architecture: trace/correlation propagation).
 *
 * Two complementary mechanisms are provided:
 *  - An ambient {@link AsyncLocalStorage} context so code deep in a call stack
 *    can read the current correlation id without threading it through every
 *    signature.
 *  - Explicit header (de)serialisation so the id can be carried across process
 *    boundaries (HTTP request → enqueued job payload → worker).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import type { LogContext } from './types.js';

/** The ambient context propagated across async boundaries within a process. */
export interface CorrelationContext extends LogContext {
  correlationId: string;
}

/** Canonical header used to carry the correlation id across HTTP/queue hops. */
export const CORRELATION_ID_HEADER = 'x-correlation-id' as const;

const storage = new AsyncLocalStorage<CorrelationContext>();

/** Generate a fresh, unique correlation id. */
export function generateCorrelationId(): string {
  return randomUUID();
}

/** Read the current ambient correlation context, if any. */
export function getContext(): CorrelationContext | undefined {
  return storage.getStore();
}

/** Read the current ambient correlation id, if any. */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Run `fn` within an ambient correlation context. Any provided fields are
 * merged over the current context; when no correlation id is supplied a new one
 * is generated. Returns whatever `fn` returns.
 */
export function runWithContext<T>(context: Partial<CorrelationContext>, fn: () => T): T {
  const parent = storage.getStore();
  const merged: CorrelationContext = {
    ...parent,
    ...context,
    correlationId: context.correlationId ?? parent?.correlationId ?? generateCorrelationId(),
  };
  return storage.run(merged, fn);
}

/**
 * Run `fn` within an ambient context bound to `correlationId` (generating one
 * when omitted). Convenience wrapper over {@link runWithContext}.
 */
export function withCorrelationId<T>(correlationId: string | undefined, fn: () => T): T {
  return runWithContext({ correlationId: correlationId ?? generateCorrelationId() }, fn);
}

/**
 * Return the ambient correlation id, creating and installing a new one for the
 * current context if none exists. Useful at process/queue entry points.
 */
export function getOrCreateCorrelationId(): string {
  return getCorrelationId() ?? generateCorrelationId();
}

/**
 * Extract a correlation id from an incoming header bag (case-insensitive).
 * Header values may be a string or string array (Node's raw header shape).
 */
export function correlationIdFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): string | undefined {
  if (!headers) {
    return undefined;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === CORRELATION_ID_HEADER) {
      const raw = Array.isArray(value) ? value[0] : value;
      const trimmed = raw?.trim();
      return trimmed ? trimmed : undefined;
    }
  }
  return undefined;
}

/**
 * Build the header object used to propagate a correlation id to a downstream
 * service or a queue job payload.
 */
export function correlationIdToHeaders(correlationId: string): Record<string, string> {
  return { [CORRELATION_ID_HEADER]: correlationId };
}
