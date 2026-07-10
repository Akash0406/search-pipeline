/**
 * Structured, framework-agnostic logger. Emits one JSON object per line with
 * the fields mandated by the design (timestamp, level, service, environment,
 * correlationId/requestId, userId?, connectionId?, sourceType?, stage, event,
 * durationMs, outcome, errorCode) and never logs secrets/PII (all extra fields
 * pass through the redactor).
 *
 * The default sink writes to the console; inject a custom sink/clock for tests
 * or to bridge into pino/OpenTelemetry/CloudWatch later without changing call
 * sites.
 */
import { getContext } from './correlation.js';
import { createRedactor, type Redactor } from './redaction.js';
import {
  LOG_LEVEL_WEIGHT,
  type Clock,
  type LogFields,
  type LogLevel,
  type LogRecord,
  type LogSink,
  type Logger,
} from './types.js';

/** Options for {@link createLogger}. */
export interface LoggerOptions {
  /** Deployment environment; falls back to `NODE_ENV` then `development`. */
  environment?: string;
  /** Minimum level to emit; records below it are dropped. Default `info`. */
  level?: LogLevel;
  /** Fields bound to every record produced by this logger. */
  bindings?: LogFields;
  /** Destination for formed records. Default: console JSON writer. */
  sink?: LogSink;
  /** Clock for timestamps. Default: `() => new Date()`. */
  clock?: Clock;
  /** Extra sensitive key fragments to redact beyond the defaults. */
  redactKeys?: readonly string[];
  /** Whether to fold the ambient correlation context into records. Default true. */
  useAmbientContext?: boolean;
}

/** Keys that are promoted to top-level record fields rather than treated as extras. */
const RESERVED_FIELDS = new Set(['error', 'errorCode', 'durationMs', 'outcome']);

/** Console sink: `error`/`warn` route to their console channels, else `log`. */
export function consoleSink(record: LogRecord): void {
  const line = JSON.stringify(record);
  if (record.level === 'error') {
    console.error(line);
  } else if (record.level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function summariseError(error: unknown): {
  errorCode?: string;
  errorName?: string;
  errorMessage?: string;
} {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(typeof code === 'string' ? { errorCode: code } : {}),
    };
  }
  if (typeof error === 'string') {
    return { errorMessage: error };
  }
  return {};
}

class StructuredLogger implements Logger {
  private readonly service: string;
  private readonly environment: string;
  private readonly minWeight: number;
  private readonly bindings: LogFields;
  private readonly sink: LogSink;
  private readonly clock: Clock;
  private readonly redactor: Redactor;
  private readonly useAmbientContext: boolean;

  constructor(service: string, options: LoggerOptions, redactor: Redactor) {
    this.service = service;
    this.environment = options.environment ?? process.env.NODE_ENV ?? 'development';
    this.minWeight = LOG_LEVEL_WEIGHT[options.level ?? 'info'];
    this.bindings = options.bindings ?? {};
    this.sink = options.sink ?? consoleSink;
    this.clock = options.clock ?? (() => new Date());
    this.redactor = redactor;
    this.useAmbientContext = options.useAmbientContext ?? true;
  }

  debug(event: string, fields?: LogFields): void {
    this.emit('debug', event, fields);
  }

  info(event: string, fields?: LogFields): void {
    this.emit('info', event, fields);
  }

  warn(event: string, fields?: LogFields): void {
    this.emit('warn', event, fields);
  }

  error(event: string, fields?: LogFields): void {
    this.emit('error', event, fields);
  }

  child(bindings: LogFields): Logger {
    const merged = { ...this.bindings, ...bindings };
    const child = Object.create(StructuredLogger.prototype) as StructuredLogger;
    Object.assign(child, this, { bindings: merged });
    return child;
  }

  withCorrelationId(correlationId: string): Logger {
    return this.child({ correlationId });
  }

  private emit(level: LogLevel, event: string, fields?: LogFields): void {
    if (LOG_LEVEL_WEIGHT[level] < this.minWeight) {
      return;
    }

    const ambient = this.useAmbientContext ? getContext() : undefined;
    const { error, errorCode, durationMs, outcome, ...rest } = {
      ...ambient,
      ...this.bindings,
      ...fields,
    } as LogFields;

    // Redact the free-form extras (never the fixed, non-sensitive envelope).
    const extras = this.redactor(
      Object.fromEntries(Object.entries(rest).filter(([key]) => !RESERVED_FIELDS.has(key))),
    ) as Record<string, unknown>;

    const errorSummary = error === undefined ? {} : summariseError(error);

    const record: LogRecord = {
      timestamp: this.clock().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      event,
      ...extras,
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(outcome !== undefined ? { outcome } : {}),
      ...errorSummary,
      ...(errorCode !== undefined ? { errorCode } : {}),
    };

    this.sink(record);
  }
}

/**
 * Create a structured logger bound to a service name (e.g. `api`, `worker`).
 * The logger folds in the ambient correlation context on each call so ids
 * propagated via {@link runWithContext} appear automatically.
 */
export function createLogger(service: string, options: LoggerOptions = {}): Logger {
  const redactor = createRedactor(options.redactKeys ? { extraKeys: options.redactKeys } : {});
  return new StructuredLogger(service, options, redactor);
}
