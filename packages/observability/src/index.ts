/**
 * `@careerstack/observability` — framework-agnostic structured logging,
 * correlation-id propagation, and metric/tracing hooks shared by the API and
 * worker.
 *
 * This package is pure infrastructure: it depends only on Node built-ins
 * (`node:async_hooks`, `node:crypto`) and imports no framework
 * (NestJS/Fastify/Next) or adapter (Drizzle/ioredis). Real backends
 * (OpenTelemetry/CloudWatch/pino) can be injected later via the exported
 * interfaces without changing call sites.
 */

/** Package identifier, handy for diagnostics. */
export const OBSERVABILITY_PACKAGE = '@careerstack/observability' as const;

export type {
  Clock,
  LogContext,
  LogFields,
  LogLevel,
  LogRecord,
  LogSink,
  Logger,
  Outcome,
} from './types.js';
export { LOG_LEVEL_WEIGHT } from './types.js';

export { createLogger, consoleSink, type LoggerOptions } from './logger.js';

export {
  CORRELATION_ID_HEADER,
  type CorrelationContext,
  correlationIdFromHeaders,
  correlationIdToHeaders,
  generateCorrelationId,
  getContext,
  getCorrelationId,
  getOrCreateCorrelationId,
  runWithContext,
  withCorrelationId,
} from './correlation.js';

export {
  DEFAULT_SENSITIVE_KEYS,
  REDACTED,
  type RedactOptions,
  type Redactor,
  createRedactor,
  redact,
} from './redaction.js';

export {
  type Counter,
  type Gauge,
  type Histogram,
  InMemoryMetricsBackend,
  type MetricLabels,
  type MetricsBackend,
  NoopMetricsBackend,
  type RecordedSample,
  createMetrics,
} from './metrics.js';

export {
  NoopTracer,
  type Span,
  type SpanAttributeValue,
  type SpanOptions,
  type SpanStatus,
  type Tracer,
  annotateSpanWithCorrelation,
  createTracer,
} from './tracing.js';
