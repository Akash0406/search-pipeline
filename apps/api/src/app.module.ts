/**
 * Root application module.
 *
 * Composes the global {@link CoreModule} (config/db/logger/clock/crypto), the
 * feature modules for this slice ({@link AuthModule},
 * {@link RoleProfilesModule}, {@link OpportunitiesModule}, {@link AdminModule},
 * {@link PrivacyModule}, {@link HealthModule}), and the global exception filter
 * that renders the standard error envelope.
 */
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CoreModule } from './common/core.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { AuthModule } from './auth/auth.module.js';
import { RoleProfilesModule } from './role-profiles/role-profiles.module.js';
import { OpportunitiesModule } from './opportunities/opportunities.module.js';
import { AdminModule } from './admin/admin.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    RoleProfilesModule,
    OpportunitiesModule,
    AdminModule,
    PrivacyModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
