/**
 * Opportunity explorer + detail + save/dismiss routes (Design API §7, Task
 * 11.1):
 *   GET    /opportunities              — filtered/sorted/cursor list, NO
 *                                         `description` (Req 40–42, 58.3)
 *   GET    /opportunities/:id          — full detail + sources + evidence (45)
 *   PUT    /opportunities/:id/save     — save for the caller (Req 43.1)
 *   DELETE /opportunities/:id/save     — reverse a save → none (Req 43.3)
 *   PUT    /opportunities/:id/dismiss  — dismiss for the caller (Req 43.2)
 *   DELETE /opportunities/:id/dismiss  — reverse a dismiss → none (Req 43.3)
 *
 * All routes are authenticated (global session guard); state-changing routes
 * are CSRF-protected. Per-user state is scoped to the caller at the repository
 * layer (`WHERE user_id = :userId`, Req 43.4), so no cross-user leakage is
 * possible. The list query string is parsed with the shared
 * `decodeExplorerState` codec (unknown/invalid params are ignored), and cursor
 * pagination params are validated against the shared schema.
 */
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import {
  decodeExplorerState,
  paginationQuerySchema,
  type OpportunityDetail,
  type OpportunityListResponse,
  type OpportunityUserStateResponse,
} from '@careerstack/contracts';
import { CurrentUser } from '../common/decorators.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { OpportunitiesService } from './opportunities.service.js';

/** Raw query values as Fastify/Nest hand them over. */
type RawQuery = Record<string, string | string[] | undefined>;

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RawQuery,
  ): Promise<OpportunityListResponse> {
    const params = toSearchParams(query);
    const state = decodeExplorerState(params);

    const pagination = paginationQuerySchema.safeParse({
      cursor: params.get('cursor') ?? undefined,
      limit: params.get('limit') ?? undefined,
    });
    if (!pagination.success) {
      throw new BadRequestException(
        pagination.error.issues[0]?.message ?? 'Invalid pagination parameters.',
      );
    }

    return this.opportunities.list(user.id, state, pagination.data);
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OpportunityDetail> {
    return this.opportunities.detail(user.id, id);
  }

  @Put(':id/save')
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OpportunityUserStateResponse> {
    return this.opportunities.save(user.id, id);
  }

  @Delete(':id/save')
  async unsave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OpportunityUserStateResponse> {
    return this.opportunities.unsave(user.id, id);
  }

  @Put(':id/dismiss')
  async dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OpportunityUserStateResponse> {
    return this.opportunities.dismiss(user.id, id);
  }

  @Delete(':id/dismiss')
  async undismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OpportunityUserStateResponse> {
    return this.opportunities.undismiss(user.id, id);
  }
}

/** Normalize a parsed query object into `URLSearchParams` for the codec. */
function toSearchParams(query: RawQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      params.set(key, value);
    } else if (Array.isArray(value) && typeof value[0] === 'string') {
      params.set(key, value[0]);
    }
  }
  return params;
}
