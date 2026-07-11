/**
 * OpenAPI document endpoint (Design API §7 — contracts as the single source of
 * truth; Req 33.1).
 *
 *   GET /api/v1/openapi.json — the generated OpenAPI 3.0 document built from the
 *   shared `@careerstack/contracts` Zod schemas.
 *
 * Public (no session required) so tooling and clients can fetch the spec. The
 * document is built once and memoized for the process lifetime.
 */
import { Controller, Get } from '@nestjs/common';
import { buildOpenApiDocument } from '@careerstack/contracts';
import { Public } from '../common/decorators.js';

/** The OpenAPI document type, inferred from the contracts builder. */
type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;

@Controller('openapi.json')
export class OpenApiController {
  private document?: OpenApiDocument;

  @Public()
  @Get()
  getDocument(): OpenApiDocument {
    this.document ??= buildOpenApiDocument();
    return this.document;
  }
}
