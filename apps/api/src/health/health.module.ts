/**
 * HealthModule — liveness/readiness probes. The DB handle comes from the global
 * CoreModule; no additional providers are needed.
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { DependencyProbe } from './dependency-probe.service.js';

@Module({
  controllers: [HealthController],
  providers: [DependencyProbe],
})
export class HealthModule {}
