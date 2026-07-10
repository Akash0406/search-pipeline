/**
 * HealthModule — liveness/readiness probes. The DB handle comes from the global
 * CoreModule; no additional providers are needed.
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
