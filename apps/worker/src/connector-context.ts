/**
 * Builds the {@link ConnectorContext} handed to connectors at each stage.
 *
 * The connection's stored `config` (board slug / domain / options) is merged
 * with pipeline-injected values: the {@link CheckpointStore} (so connectors
 * persist checkpoints without a DB import), the previously stored `rawArtifactId`
 * (so evidence points at the persisted artifact, OPP-003.1), and a cooperative
 * `AbortSignal` for graceful shutdown.
 */

import {
  CHECKPOINT_STORE_CONFIG_KEY,
  type ConnectorContext,
} from '@careerstack/connectors';
import type { PipelineContext } from './context.js';

export interface BuildConnectorContextInput {
  pipeline: PipelineContext;
  connectionId: string;
  correlationId: string;
  connectionConfig: Record<string, unknown>;
  signal: AbortSignal;
  /** Injected so evidence records reference the stored artifact (OPP-003.1). */
  rawArtifactId?: string;
}

/** Assemble a {@link ConnectorContext} for a single connection/stage. */
export function buildConnectorContext(
  input: BuildConnectorContextInput,
): ConnectorContext {
  const config: Record<string, unknown> = {
    ...input.connectionConfig,
    [CHECKPOINT_STORE_CONFIG_KEY]: input.pipeline.checkpointStore,
  };
  if (input.rawArtifactId !== undefined) {
    config['rawArtifactId'] = input.rawArtifactId;
  }
  return {
    connectionId: input.connectionId,
    config,
    fetcher: input.pipeline.fetcher,
    logger: input.pipeline.logger.child({
      connectionId: input.connectionId,
      correlationId: input.correlationId,
    }),
    correlationId: input.correlationId,
    signal: input.signal,
  };
}
