/**
 * Connector registry keyed by {@link SourceType}. The scheduler/worker treat
 * every connector uniformly through this registry; a new source registers here
 * and requires no changes to the scheduler, pipeline, rate limiter, or DLQ
 * (SRC-001.3, Req 20.3).
 */

import type { OpportunityConnector, SourceType } from './types.js';

export class ConnectorRegistry {
  private readonly byType = new Map<SourceType, OpportunityConnector>();

  /** Register a connector. Throws if its source type is already registered. */
  register(connector: OpportunityConnector): this {
    if (this.byType.has(connector.sourceType)) {
      throw new Error(
        `A connector is already registered for source type "${connector.sourceType}"`,
      );
    }
    this.byType.set(connector.sourceType, connector);
    return this;
  }

  has(sourceType: SourceType): boolean {
    return this.byType.has(sourceType);
  }

  get(sourceType: SourceType): OpportunityConnector | undefined {
    return this.byType.get(sourceType);
  }

  /** Return the connector for a source type, throwing if none is registered. */
  require(sourceType: SourceType): OpportunityConnector {
    const connector = this.byType.get(sourceType);
    if (!connector) {
      throw new Error(
        `No connector registered for source type "${sourceType}"`,
      );
    }
    return connector;
  }

  list(): OpportunityConnector[] {
    return [...this.byType.values()];
  }

  sourceTypes(): SourceType[] {
    return [...this.byType.keys()];
  }
}
