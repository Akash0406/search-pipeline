/**
 * Role-profile routes (Design API §7):
 *   GET    /role-profiles              — list the user's profiles (Req 10.1)
 *   POST   /role-profiles              — create (first auto-activates, Req 10.4)
 *   GET    /role-profiles/:id          — full detail (Req 10.5, 19.4)
 *   PATCH  /role-profiles/:id          — partial update (Req 19.1)
 *   DELETE /role-profiles/:id?confirm  — confirmation-gated delete (Req 19.2)
 *   POST   /role-profiles/:id/activate — set active, deactivate previous (10.3)
 *   POST   /role-profiles/:id/duplicate— copy preferences, keep active (Req 17)
 *   POST   /role-profiles/:id/pause    — pause; active needs replacement (18.2)
 *   POST   /role-profiles/:id/resume   — resume to active-eligible (Req 18.3)
 *
 * Every route is authenticated (global session guard) and state-changing routes
 * are CSRF-protected. Ownership is enforced canonically at the repository layer
 * (`WHERE user_id = :ownerId`); foreign/missing ids surface as 404 (Req 10.5,
 * 19.4). Request bodies are validated against the shared contracts Zod schemas.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import {
  createRoleProfileRequestSchema,
  updateRoleProfileRequestSchema,
  type RoleProfileDetail,
  type RoleProfileListResponse,
} from '@careerstack/contracts';
import { CurrentUser } from '../common/decorators.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { RoleProfilesService, type DeleteRoleProfileResult } from './role-profiles.service.js';

/** Optional pause body — the replacement active profile to activate first. */
const pauseRequestSchema = z.object({ activateProfileId: z.string().min(1).optional() }).optional();

@Controller('role-profiles')
export class RoleProfilesController {
  constructor(private readonly profiles: RoleProfilesService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<RoleProfileListResponse> {
    const profiles = await this.profiles.list(user.id);
    return { profiles };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<RoleProfileDetail> {
    const parsed = createRoleProfileRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid role profile.');
    }
    return this.profiles.create(user.id, parsed.data);
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RoleProfileDetail> {
    return this.profiles.getDetail(user.id, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<RoleProfileDetail> {
    const parsed = updateRoleProfileRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid role profile update.',
      );
    }
    return this.profiles.update(user.id, id, parsed.data);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('confirm') confirm?: string,
  ): Promise<DeleteRoleProfileResult> {
    // Destructive-action rule (Req 19.2): require explicit confirmation intent.
    if (confirm !== 'true') {
      throw new BadRequestException('Deleting a role profile requires explicit confirmation.');
    }
    return this.profiles.delete(user.id, id);
  }

  @Post(':id/activate')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RoleProfileDetail> {
    return this.profiles.activate(user.id, id);
  }

  @Post(':id/duplicate')
  async duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RoleProfileDetail> {
    return this.profiles.duplicate(user.id, id);
  }

  @Post(':id/pause')
  async pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<RoleProfileDetail> {
    const parsed = pauseRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid pause request.');
    }
    return this.profiles.pause(user.id, id, parsed.data?.activateProfileId);
  }

  @Post(':id/resume')
  async resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RoleProfileDetail> {
    return this.profiles.resume(user.id, id);
  }
}
