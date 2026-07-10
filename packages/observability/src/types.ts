/**
 * Shared observability types: structured-log records, correlation context, and
 * the framework-agnostic `Logger` contract used across the API and worker.
 *
 * These types intentionally avoid any framework/runtime dependency so the
 * package can be imported broadly (API, worker, packages) while staying
 * portable to an OpenTelemetry/CloudWatch backend later.
 */

/** Severity levels, ordered from least to most severe. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Numeric ordering used to filter records below the configured minimum level. */
export const LOG_LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Outcome of the operation being logged. A known union is provided for the
 * common cases; any other string is still accepted for forward compatibility.
 */
export type Outcome = 'success' | 'failure' | 'skipped' | 'deferred' | (string & {});

/**
 * Correlation/trace context carried across API → queue → worker. Every field is
 * optional; the logger only emits the ones that are present.
 */
export interface LogContext {
  /** Correlation id propagated end-to-end for a single logical operation. */
  correlationId?: string;
  /** Distributed-trace id (joins spans across services). */
  traceId?: string;
  /** Inbound HTTP request id (echoed as `X-Request-Id`). */
  requestId?: string;
  /** Owning user, when the operation is performed on behalf of a user. */
  userId?: string;
  /** Connection the operation relates to (ingestion). */
  connectionId?: string;
  /** Source type (e.g. `greenhouse`, `lever`, `manual_url`). */
  sourceType?: string;
  /** Pipeline stage (e.g. `discover`, `fetch`, `parse`, `normalize`, `dedup`). */
  stage?: string;
}

/**
 * Structured fields accepted by every log call. Combines the correlation
 * context with per-call measurements and arbitrary extra key/values (which are
 * redacted before emission).
 */
export interface LogFields extends LogContext {
  /** Duration of the measured operation in milliseconds. */
  durationMs?: number;
  /** Terminal outcome of the operation. */
  outcome?: Outcome;
  /** Machine-readable error code (never a raw message containing PII). */
  errorCode?: string;
  /** An error to summarise (name/message/code only — no secrets). */
  error?: unknown;
  /** Any additional structured fields; values are redacted before emission. */
  [key: string]: unknown;
}

/**
 * The fully-formed record handed to a {@link LogSink}. This is the exact shape
 * that is serialised to the log stream.
 */
export interface LogRecord extends LogContext {
  /** ISO-8601 timestamp. */
  timestamp: string;
  level: LogLevel;
  /** Emitting service, e.g. `api` or `worker`. */
  service: string;
  /** Deployment environment, e.g. `development`, `production`. */
  environment: string;
  /** Short, stable event name, e.g. `connector.run.completed`. */
  event: string;
  durationMs?: number;
  outcome?: Outcome;
  errorCode?: string;
  /** Redacted, structured extra fields supplied at the call site. */
  [key: string]: unknown;
}

/** A destination for formed log records (defaults to a console JSON writer). */
export type LogSink = (record: LogRecord) => void;

/** Injectable clock so callers/tests can control timestamps. */
export type Clock = () => Date;

/**
 * Framework-agnostic structured logger. Bind context once (service, correlation
 * id, connection id, …) and emit terse, evented log lines.
 */
export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** Derive a logger that always includes the given bound fields. */
  child(bindings: LogFields): Logger;
  /** Convenience: derive a child bound to a correlation id. */
  withCorrelationId(correlationId: string): Logger;
}
