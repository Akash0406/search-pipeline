/**
 * Worker entrypoint. Bootstraps the ingestion pipeline and installs SIGTERM /
 * SIGINT handlers that drain in-flight jobs before exiting (ECS task drain,
 * Design Worker §9).
 *
 * Guarded so importing this module for its exports (tests) does not start a
 * worker; set `CAREERSTACK_WORKER_BOOTSTRAP=off` to disable auto-run.
 */

import { createLogger } from '@careerstack/observability';
import { bootstrap, type WorkerRuntime } from './bootstrap.js';

export async function main(): Promise<WorkerRuntime> {
  const logger = createLogger('worker');
  const runtime = await bootstrap(logger);

  let shuttingDown = false;
  const onSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('worker.signal', { stage: 'bootstrap', signal });
    runtime
      .shutdown()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        logger.error('worker.shutdown.failed', { stage: 'bootstrap', error: err });
        process.exit(1);
      });
  };

  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
  return runtime;
}

if (process.env.CAREERSTACK_WORKER_BOOTSTRAP !== 'off') {
  main().catch((error: unknown) => {
    console.error('[worker] failed to start', error);
    process.exit(1);
  });
}
