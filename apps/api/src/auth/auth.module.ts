/**
 * AuthModule — passwordless authentication, sessions, and authorization
 * (Req 4–9, 52, 54).
 *
 * Wires the framework-agnostic `@careerstack/auth` core (session, magic-link,
 * OAuth+PKCE, CSRF services) to Drizzle-backed stores and Node crypto/clock via
 * factory providers, exposes the auth/session controllers, and registers the
 * global session + CSRF guards. The admin and ownership guards are exported for
 * later feature modules.
 */
import { Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  CsrfService,
  MagicLinkService,
  OAuthStateService,
  SessionService,
  type CryptoProvider,
  type Clock as AuthClock,
  type MagicLinkStore,
  type SessionStore,
} from '@careerstack/auth';
import type { Config } from '@careerstack/config';
import { CLOCK, CONFIG, CRYPTO, MAGIC_LINK_STORE, SESSION_STORE } from '../common/di-tokens.js';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { CsrfGuard } from '../common/guards/csrf.guard.js';
import { AdminGuard } from '../common/guards/admin.guard.js';
import { OwnershipGuard } from '../common/guards/ownership.guard.js';
import { DrizzleSessionStore } from './stores/session.store.js';
import { DrizzleMagicLinkStore } from './stores/magic-link.store.js';
import { UserService } from './user.service.js';
import { AuditService } from './audit.service.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { AuthController } from './auth.controller.js';
import { SessionsController } from './sessions.controller.js';

const sessionServiceProvider: Provider = {
  provide: SessionService,
  useFactory: (store: SessionStore, crypto: CryptoProvider, clock: AuthClock, config: Config) =>
    new SessionService({
      store,
      crypto,
      clock,
      config: { ttlHours: config.auth.session.ttlHours },
    }),
  inject: [SESSION_STORE, CRYPTO, CLOCK, CONFIG],
};

const magicLinkServiceProvider: Provider = {
  provide: MagicLinkService,
  useFactory: (store: MagicLinkStore, crypto: CryptoProvider, clock: AuthClock, config: Config) =>
    new MagicLinkService({
      store,
      crypto,
      clock,
      config: { ttlMinutes: config.auth.magicLink.tokenTtlMinutes },
    }),
  inject: [MAGIC_LINK_STORE, CRYPTO, CLOCK, CONFIG],
};

const oauthStateServiceProvider: Provider = {
  provide: OAuthStateService,
  useFactory: (crypto: CryptoProvider, clock: AuthClock, config: Config) =>
    new OAuthStateService({ crypto, clock, secret: config.auth.session.secret }),
  inject: [CRYPTO, CLOCK, CONFIG],
};

const csrfServiceProvider: Provider = {
  provide: CsrfService,
  useFactory: (crypto: CryptoProvider) => new CsrfService(crypto),
  inject: [CRYPTO],
};

@Module({
  controllers: [AuthController, SessionsController],
  providers: [
    // Store adapters + interface bindings
    DrizzleSessionStore,
    DrizzleMagicLinkStore,
    { provide: SESSION_STORE, useExisting: DrizzleSessionStore },
    { provide: MAGIC_LINK_STORE, useExisting: DrizzleMagicLinkStore },
    // Auth-core services (framework-agnostic, constructed via factories)
    sessionServiceProvider,
    magicLinkServiceProvider,
    oauthStateServiceProvider,
    csrfServiceProvider,
    // Feature services
    UserService,
    AuditService,
    GoogleOAuthService,
    // Guards
    AdminGuard,
    OwnershipGuard,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [SessionService, UserService, AuditService, AdminGuard, OwnershipGuard],
})
export class AuthModule {}
