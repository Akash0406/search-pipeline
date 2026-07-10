/**
 * Global CSRF double-submit guard (Design API §7).
 *
 * Enforces the double-submit token on state-changing requests (POST/PUT/PATCH/
 * DELETE) for non-public routes: the readable CSRF cookie must equal the value
 * echoed in the `x-csrf-token` header. Public routes (sign-in, OAuth callback,
 * logout, health) are exempt since they run before a CSRF cookie is issued.
 */
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfService, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@careerstack/auth';
import { IS_PUBLIC_KEY } from '../decorators.js';
import type { AuthenticatedRequest } from '../request-context.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly csrf: CsrfService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const rawHeader = request.headers[CSRF_HEADER_NAME];
    const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!this.csrf.verify(cookieToken, headerToken)) {
      throw new ForbiddenException('Invalid or missing CSRF token.');
    }
    return true;
  }
}
