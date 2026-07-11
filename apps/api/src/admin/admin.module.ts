/**
 * AdminModule — basic admin connector-health surface (Capability H, Req 47–48).
 *
 * Imports {@link AuthModule} to reuse the exported {@link AdminGuard} (which
 * enforces the admin role AND records an `admin_access` audit event on each
 * granted access — Req 47.3, 48.3). All routes are read-only operational
 * projections; the shared DB handle comes from the global CoreModule.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
