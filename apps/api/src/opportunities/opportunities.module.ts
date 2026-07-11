/**
 * OpportunitiesModule — explorer list (projected, no descriptions), detail
 * (+ source history/evidence), and per-user save/dismiss (Capability G, Req
 * 40–46).
 *
 * Imports {@link AuthModule} to align with the other feature modules (the
 * global session + CSRF guards apply to every route). Canonical opportunities
 * are global reads; the per-user overlay is scoped to the caller inside
 * {@link OpportunityRepository} (`WHERE user_id = :userId`, Req 43.4). The DB
 * handle comes from the global CoreModule.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OpportunitiesController } from './opportunities.controller.js';
import { OpportunitiesService } from './opportunities.service.js';
import { OpportunityRepository } from './opportunity.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, OpportunityRepository],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
