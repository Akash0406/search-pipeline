/**
 * Global session authentication guard (AUTH-003, Req 6.2).
 *
 * Reads the session cookie, resolves it to an active (non-revoked, non-expired)
 * session, loads the owning user, and attaches both to the request. Revoked or
 * expired sessions and deleted users are rejected with 401. Routes marked
 * `@Public()` bypass the guard (sign-in, callbacks, health).
 */
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Config } from '@careerstack/config';
import { SessionService } from '@careerstack/auth';
import { CONFIG } from '../di-tokens.js';
import { IS_PUBLIC_KEY } from '../decorators.js';
import type { AuthenticatedRequest } from '../request-context.js';
import { UserService } from '../../auth/user.service.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CONFIG) private readonly config: Config,
    private readonly sessions: SessionService,
    private readonly users: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawToken = request.cookies?.[this.config.auth.session.cookieName];
    if (!rawToken) {
      throw new UnauthorizedException('Authentication required.');
    }

    const session = await this.sessions.authenticate(rawToken);
    if (!session) {
      throw new UnauthorizedException('Your session is no longer valid.');
    }

    const user = await this.users.findActiveById(session.userId);
    if (!user) {
      throw new UnauthorizedException('Your session is no longer valid.');
    }

    request.authUser = user;
    request.authSession = session;
    return true;
  }
}
