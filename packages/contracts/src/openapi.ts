/**
 * OpenAPI generation. Registers the shared Zod schemas as reusable components
 * and builds an OpenAPI 3.0 document — the single source of truth for API I/O
 * (Req 33.1, Design API §7).
 *
 * Usage:
 *   import { buildOpenApiDocument } from '@careerstack/contracts';
 *   const doc = buildOpenApiDocument();
 */
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { z } from 'zod';

import { errorEnvelopeSchema, pageInfoSchema } from './common/envelopes.js';
import {
  evidenceSchema,
  opportunityDetailSchema,
  opportunityListItemSchema,
  opportunitySourceRefSchema,
  salaryRangeSchema,
} from './common/opportunity.js';
import {
  authSessionResultSchema,
  googleOAuthStartResponseSchema,
  magicLinkRequestSchema,
} from './auth.js';
import {
  meResponseSchema,
  preferencesResponseSchema,
  sessionListItemSchema,
  updatePreferencesRequestSchema,
} from './me.js';
import {
  createRoleProfileRequestSchema,
  roleProfileDetailSchema,
  roleProfileListItemSchema,
  updateRoleProfileRequestSchema,
} from './role-profiles.js';
import {
  connectionSchema,
  connectorListItemSchema,
  connectorRunSchema,
  createConnectionRequestSchema,
  manualUrlSubmitRequestSchema,
  updateConnectionRequestSchema,
} from './connections.js';
import {
  opportunityListResponseSchema,
  opportunityUserStateResponseSchema,
} from './opportunities.js';
import {
  connectorHealthItemSchema,
  parserFailureItemSchema,
  reviewQueueItemSchema,
} from './admin.js';
import {
  deleteAccountRequestSchema,
  deleteDataRequestSchema,
  exportStatusResponseSchema,
} from './privacy.js';
import { explorerStateSchema } from './explorer.js';

// Patch Zod with `.openapi()` support. Must run before the generator reads schemas.
extendZodWithOpenApi(z);

/** All named components emitted into the OpenAPI document. */
const COMPONENT_SCHEMAS = {
  ErrorEnvelope: errorEnvelopeSchema,
  PageInfo: pageInfoSchema,

  SalaryRange: salaryRangeSchema,
  Evidence: evidenceSchema,
  OpportunitySourceRef: opportunitySourceRefSchema,
  OpportunityListItem: opportunityListItemSchema,
  OpportunityDetail: opportunityDetailSchema,
  OpportunityListResponse: opportunityListResponseSchema,
  OpportunityUserStateResponse: opportunityUserStateResponseSchema,

  GoogleOAuthStartResponse: googleOAuthStartResponseSchema,
  MagicLinkRequest: magicLinkRequestSchema,
  AuthSessionResult: authSessionResultSchema,

  MeResponse: meResponseSchema,
  UpdatePreferencesRequest: updatePreferencesRequestSchema,
  PreferencesResponse: preferencesResponseSchema,
  SessionListItem: sessionListItemSchema,

  CreateRoleProfileRequest: createRoleProfileRequestSchema,
  UpdateRoleProfileRequest: updateRoleProfileRequestSchema,
  RoleProfileListItem: roleProfileListItemSchema,
  RoleProfileDetail: roleProfileDetailSchema,

  ConnectorListItem: connectorListItemSchema,
  Connection: connectionSchema,
  ConnectorRun: connectorRunSchema,
  CreateConnectionRequest: createConnectionRequestSchema,
  UpdateConnectionRequest: updateConnectionRequestSchema,
  ManualUrlSubmitRequest: manualUrlSubmitRequestSchema,

  ConnectorHealthItem: connectorHealthItemSchema,
  ReviewQueueItem: reviewQueueItemSchema,
  ParserFailureItem: parserFailureItemSchema,

  ExportStatusResponse: exportStatusResponseSchema,
  DeleteAccountRequest: deleteAccountRequestSchema,
  DeleteDataRequest: deleteDataRequestSchema,

  ExplorerState: explorerStateSchema,
} as const;

/** Info block for the generated OpenAPI document. */
export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
}

const DEFAULT_INFO: OpenApiInfo = {
  title: 'CareerStack API',
  version: '1.0.0',
  description: 'Shared contracts for the foundation-discovery-core slice.',
};

/**
 * Build an OpenAPI 3.0 document object containing all shared schema components.
 * Callers (the API app) can extend this with concrete route definitions.
 */
export function buildOpenApiDocument(info: OpenApiInfo = DEFAULT_INFO): OpenAPIObject {
  const registry = new OpenAPIRegistry();
  for (const [name, schema] of Object.entries(COMPONENT_SCHEMAS)) {
    registry.register(name, schema);
  }
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: info.title,
      version: info.version,
      ...(info.description !== undefined ? { description: info.description } : {}),
    },
    servers: [{ url: '/api/v1' }],
  });
}

/** The list of component schema names emitted by {@link buildOpenApiDocument}. */
export const openApiComponentNames = Object.keys(COMPONENT_SCHEMAS);
