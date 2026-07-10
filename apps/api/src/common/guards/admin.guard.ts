/**
 * Admin role guard (AUTH-005, Req 8).
 *
 * Runs after the global session guard. Non-admins are denied with 403 (Req
 * 8.3); a granted admin access is recorded as an audit event (Req 8.4, 48.3).
 * Apply per admin-only controller/route via `@UseGuards(AdminGuard)`.
 */
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../request-context.js';
import { AuditService } from '../../auth/audit.service.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly audit: AuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authUser;
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (user.role !== 'admin') {
      throw new ForbiddenException('Administrator access is required for this resource.');
    }
    await this.audit.record({
      eventType: 'admin_access',
      userId: user.id,
      actor: 'admin',
      outcome: 'success',
      targetRef: request.url,
    });
    return true;
  }
}
