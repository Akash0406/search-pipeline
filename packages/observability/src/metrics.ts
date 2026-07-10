/**
 * Lightweight metric hooks. The interfaces mirror the counter/histogram shape
 * used by OpenTelemetry/Prometheus/CloudWatch so a real backend can be dropped
 * in later without touching call sites. Two built-in backends are provided:
 *  - {@link NoopMetricsBackend}: discards everything (safe default in prod
 *    before a real exporter is wired up).
 *  - {@link InMemoryMetricsBackend}: records values for tests/inspection.
 *
 * Metric names from the design (e.g. `connector_runs_total`, `api_latency`,
 * `queue_depth`, `dead_letter_count`) are created through these factories.
 */

/** Label set attached to a metric sample. */
export type MetricLabels = Readonly<Record<string, string | number>>;

/** A monotonically increasing counter. */
export interface Counter {
  increment(value?: number, labels?: MetricLabels): void;
}

/** A distribution of observed values (latencies, sizes, …). */
export interface Histogram {
  observe(value: number, labels?: MetricLabels): void;
}

/** A point-in-time gauge (queue depth, DLQ depth, …). */
export interface Gauge {
  set(value: number, labels?: MetricLabels): void;
}

/** Factory for named metric instruments. */
export interface MetricsBackend {
  counter(name: string, help?: string): Counter;
  histogram(name: string, help?: string): Histogram;
  gauge(name: string, help?: string): Gauge;
}

/** A no-op backend: every operation is discarded. */
export class NoopMetricsBackend implements MetricsBackend {
  private static readonly counter: Counter = { increment(): void {} };
  private static readonly histogram: Histogram = { observe(): void {} };
  private static readonly gauge: Gauge = { set(): void {} };

  counter(): Counter {
    return NoopMetricsBackend.counter;
  }

  histogram(): Histogram {
    return NoopMetricsBackend.histogram;
  }

  gauge(): Gauge {
    return NoopMetricsBackend.gauge;
  }
}

/** A single recorded metric observation, retained by {@link InMemoryMetricsBackend}. */
export interface RecordedSample {
  readonly value: number;
  readonly labels: MetricLabels;
}

function labelsKey(labels: MetricLabels): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * In-memory backend that accumulates samples so tests can assert on emitted
 * metrics. Counters are summed per label-set; histograms/gauges retain every
 * observation in order.
 */
export class InMemoryMetricsBackend implements MetricsBackend {
  private readonly counters = new Map<string, Map<string, number>>();
  private readonly histograms = new Map<string, RecordedSample[]>();
  private readonly gauges = new Map<string, Map<string, number>>();

  counter(name: string): Counter {
    const perLabel = this.counters.get(name) ?? new Map<string, number>();
    this.counters.set(name, perLabel);
    return {
      increment: (value = 1, labels = {}) => {
        const key = labelsKey(labels);
        perLabel.set(key, (perLabel.get(key) ?? 0) + value);
      },
    };
  }

  histogram(name: string): Histogram {
    const samples = this.histograms.get(name) ?? [];
    this.histograms.set(name, samples);
    return {
      observe: (value, labels = {}) => {
        samples.push({ value, labels });
      },
    };
  }

  gauge(name: string): Gauge {
    const perLabel = this.gauges.get(name) ?? new Map<string, number>();
    this.gauges.set(name, perLabel);
    return {
      set: (value, labels = {}) => {
        perLabel.set(labelsKey(labels), value);
      },
    };
  }

  /** Total counter value across all label-sets (or a specific label-set). */
  counterValue(name: string, labels?: MetricLabels): number {
    const perLabel = this.counters.get(name);
    if (!perLabel) {
      return 0;
    }
    if (labels) {
      return perLabel.get(labelsKey(labels)) ?? 0;
    }
    let total = 0;
    for (const value of perLabel.values()) {
      total += value;
    }
    return total;
  }

  /** All histogram observations recorded under `name`. */
  histogramSamples(name: string): readonly RecordedSample[] {
    return this.histograms.get(name) ?? [];
  }

  /** Latest gauge value for a label-set (defaults to the empty label-set). */
  gaugeValue(name: string, labels: MetricLabels = {}): number | undefined {
    return this.gauges.get(name)?.get(labelsKey(labels));
  }

  /** Drop all recorded samples. */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

/**
 * Create the default metrics backend. Returns a no-op backend unless an
 * explicit backend is supplied, keeping production paths allocation-free until
 * a real exporter is configured.
 */
export function createMetrics(backend?: MetricsBackend): MetricsBackend {
  return backend ?? new NoopMetricsBackend();
}
