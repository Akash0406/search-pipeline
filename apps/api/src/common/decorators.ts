/**
 * Route decorators: `@Public()` opts a route out of the global session guard;
 * `@CurrentUser()` / `@CurrentSession()` inject the authenticated principal.
 */
import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from './request-context.js';

/** Metadata key marking a handler/controller as publicly accessible. */
export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as public (bypasses the global {@link SessionAuthGuard}). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Injects the authenticated user; throws 401 if the guard did not set one. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) {
      throw new UnauthorizedException('Authentication required.');
    }
    return request.authUser;
  },
);

/** Injects the current session id; throws 401 when unauthenticated. */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authSession) {
      throw new UnauthorizedException('Authentication required.');
    }
    return request.authSession.id;
  },
);
