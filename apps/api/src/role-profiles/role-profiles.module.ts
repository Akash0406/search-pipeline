/**
 * RoleProfilesModule — role-profile CRUD plus activate/pause/resume/duplicate
 * (Capability C, Req 10–19).
 *
 * Imports {@link AuthModule} to reuse the exported guards/services (the global
 * session + CSRF guards already apply). Ownership is enforced canonically by the
 * {@link RoleProfileRepository} (extends `OwnershipScopedRepository`), so every
 * query is constrained by `WHERE user_id = :ownerId` (PRIV-006 / Req 10.5,
 * 19.4). The DB handle comes from the global CoreModule.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RoleProfilesController } from './role-profiles.controller.js';
import { RoleProfilesService } from './role-profiles.service.js';
import { RoleProfileRepository } from './role-profile.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [RoleProfilesController],
  providers: [RoleProfilesService, RoleProfileRepository],
  exports: [RoleProfilesService],
})
export class RoleProfilesModule {}
