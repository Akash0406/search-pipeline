/**
 * OpenApiModule — exposes the generated OpenAPI document at
 * `GET /api/v1/openapi.json`. No providers are needed; the document is built
 * from the shared contracts package on demand.
 */
import { Module } from '@nestjs/common';
import { OpenApiController } from './openapi.controller.js';

@Module({
  controllers: [OpenApiController],
})
export class OpenApiModule {}
