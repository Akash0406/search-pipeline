/**
 * Minimal tracing hooks. The `Tracer`/`Span` contract is a small subset of the
 * OpenTelemetry API so spans can be created across API → queue → worker stages
 * and later backed by a real exporter without changing call sites
 * (design → Observability: tracing joined by trace/correlation id).
 *
 * The default {@link NoopTracer} does nothing; it exists so instrumentation can
 * be written now and activated later by swapping the tracer.
 */
import { getCorrelationId } from './correlation.js';

/** Attribute value types accepted on a span. */
export type SpanAttributeValue = string | number | boolean;

/** Terminal status of a span. */
export type SpanStatus = 'unset' | 'ok' | 'error';

/** A single unit of work within a trace. */
export interface Span {
  setAttribute(key: string, value: SpanAttributeValue): void;
  setStatus(status: SpanStatus): void;
  recordException(error: unknown): void;
  end(): void;
}

/** Options when starting a span. */
export interface SpanOptions {
  /** Initial attributes to attach. */
  readonly attributes?: Readonly<Record<string, SpanAttributeValue>>;
}

/** Creates spans. Backed by a no-op by default; swap for a real exporter later. */
export interface Tracer {
  startSpan(name: string, options?: SpanOptions): Span;
  /**
   * Run `fn` inside a span, ending it automatically and recording any thrown
   * error as the span status. Supports sync and async `fn`.
   */
  startActiveSpan<T>(name: string, fn: (span: Span) => T, options?: SpanOptions): T;
}

const NOOP_SPAN: Span = {
  setAttribute(): void {},
  setStatus(): void {},
  recordException(): void {},
  end(): void {},
};

/** A tracer that produces inert spans. */
export class NoopTracer implements Tracer {
  startSpan(): Span {
    return NOOP_SPAN;
  }

  startActiveSpan<T>(_name: string, fn: (span: Span) => T): T {
    return runWithSpan(NOOP_SPAN, fn);
  }
}

/**
 * Shared helper that runs `fn` with a span, ending it once (even for async
 * work) and recording exceptions. Kept module-private but reused by real
 * tracer implementations built on this interface.
 */
export function runWithSpan<T>(span: Span, fn: (span: Span) => T): T {
  let result: T;
  try {
    result = fn(span);
  } catch (error) {
    span.recordException(error);
    span.setStatus('error');
    span.end();
    throw error;
  }

  if (result instanceof Promise) {
    return result.then(
      (value) => {
        span.end();
        return value;
      },
      (error: unknown) => {
        span.recordException(error);
        span.setStatus('error');
        span.end();
        throw error;
      },
    ) as T;
  }

  span.end();
  return result;
}

/**
 * Attach the ambient correlation id to a span as `correlation.id` when present,
 * so traces and structured logs can be joined. No-op when unset.
 */
export function annotateSpanWithCorrelation(span: Span): void {
  const correlationId = getCorrelationId();
  if (correlationId) {
    span.setAttribute('correlation.id', correlationId);
  }
}

/** Create the default tracer (no-op unless an explicit tracer is supplied). */
export function createTracer(tracer?: Tracer): Tracer {
  return tracer ?? new NoopTracer();
}
