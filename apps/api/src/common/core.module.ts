/**
 * Global core providers: validated {@link Config}, the shared Drizzle
 * {@link Database} handle, a structured {@link Logger}, an injectable clock, and
 * the Node crypto provider. Marked `@Global` so every feature module can inject
 * these without re-importing.
 *
 * The DB handle is created lazily and does NOT connect on construction (the
 * `pg` pool connects on first query), so the app can boot and register routes
 * without a live database.
 */
import { Global, Module, type Provider } from '@nestjs/common';
import { loadConfig, type Config } from '@careerstack/config';
import { getDb } from '@careerstack/database';
import { createLogger, type Clock, type Logger } from '@careerstack/observability';
import { nodeCryptoProvider } from '@careerstack/auth';
import { CLOCK, CONFIG, CRYPTO, DB, LOGGER } from './di-tokens.js';

const configProvider: Provider = {
  provide: CONFIG,
  useFactory: (): Config => loadConfig(),
};

const dbProvider: Provider = {
  provide: DB,
  useFactory: (config: Config) => getDb(config.db.databaseUrl).db,
  inject: [CONFIG],
};

const loggerProvider: Provider = {
  provide: LOGGER,
  useFactory: (config: Config): Logger =>
    createLogger('api', { environment: config.app.environment }),
  inject: [CONFIG],
};

const clockProvider: Provider = {
  provide: CLOCK,
  useValue: (() => new Date()) satisfies Clock,
};

const cryptoProvider: Provider = {
  provide: CRYPTO,
  useValue: nodeCryptoProvider,
};

@Global()
@Module({
  providers: [configProvider, dbProvider, loggerProvider, clockProvider, cryptoProvider],
  exports: [CONFIG, DB, LOGGER, CLOCK, CRYPTO],
})
export class CoreModule {}
