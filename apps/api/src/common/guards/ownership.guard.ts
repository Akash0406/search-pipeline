/**
 * Controller-level ownership guard (PRIV-006, Req 54).
 *
 * This is the SECOND line of defense complementing the canonical repository
 * enforcement (`OwnershipScopedRepository`, which constrains every query by
 * `WHERE user_id = :ownerId`). When a route carries a user-id route param, this
 * guard rejects a mismatch with the authenticated user before the handler runs.
 * Configure the param name with `@OwnerParam('userId')`; without it the guard
 * is a no-op and the repository layer remains the enforcement point.
 */
import { ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../request-context.js';

export const OWNER_PARAM_KEY = 'ownerParam';

/** Declare which route param carries the owning user id for this route. */
export const OwnerParam = (param = 'userId') => SetMetadata(OWNER_PARAM_KEY, param);

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const paramName = this.reflector.getAllAndOverride<string | undefined>(OWNER_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!paramName) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authUser;
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }

    const params = (request.params ?? {}) as Record<string, string | undefined>;
    const value = params[paramName];
    if (value !== undefined && value !== user.id) {
      throw new ForbiddenException('You do not have access to this resource.');
    }
    return true;
  }
}
