/**
 * Root application module.
 *
 * Composes the global {@link CoreModule} (config/db/logger/clock/crypto), the
 * feature modules for this slice ({@link AuthModule},
 * {@link RoleProfilesModule}, {@link OpportunitiesModule}, {@link AdminModule},
 * {@link PrivacyModule}, {@link EventsModule}, {@link HealthModule},
 * {@link OpenApiModule}), and the global cross-cutting providers:
 *   - {@link HttpExceptionFilter} — the standard error envelope.
 *   - {@link CorrelationInterceptor} — binds the request id into the ambient
 *     correlation context so it propagates into logs and enqueued jobs.
 *   - {@link IdempotencyInterceptor} — `Idempotency-Key` dedup for mutations,
 *     backed by the {@link IDEMPOTENCY_STORE} provider.
 *
 * Interceptors are registered outermost-first: correlation wraps idempotency so
 * the dedup path also runs inside the request's correlation context.
 */
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CoreModule } from './common/core.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor.js';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor.js';
import {
  InMemoryIdempotencyStore,
  type IdempotencyStore,
} from './common/idempotency/idempotency-store.js';
import { IDEMPOTENCY_STORE } from './common/di-tokens.js';
import { AuthModule } from './auth/auth.module.js';
import { RoleProfilesModule } from './role-profiles/role-profiles.module.js';
import { OpportunitiesModule } from './opportunities/opportunities.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ConnectionsModule } from './connections/connections.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { OpenApiModule } from './openapi/openapi.module.js';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    RoleProfilesModule,
    OpportunitiesModule,
    AdminModule,
    ConnectionsModule,
    PrivacyModule,
    EventsModule,
    HealthModule,
    OpenApiModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: CorrelationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    {
      provide: IDEMPOTENCY_STORE,
      useFactory: (): IdempotencyStore => new InMemoryIdempotencyStore(),
    },
  ],
})
export class AppModule {}
