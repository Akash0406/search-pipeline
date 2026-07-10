/**
 * Factory that builds a {@link ConnectorRegistry} pre-populated with the
 * concrete connectors implemented in this slice. The reserved `gmail` source is
 * intentionally NOT registered (future spec).
 */

import { AshbyConnector } from './connectors/ashby.js';
import { GreenhouseConnector } from './connectors/greenhouse.js';
import { JsonLdConnector } from './connectors/jsonld-connector.js';
import { LeverConnector } from './connectors/lever.js';
import { ManualUrlConnector } from './connectors/manual-url.js';
import { ConnectorRegistry } from './registry.js';

/** Create a registry with greenhouse/lever/ashby/jsonld/manual_url registered. */
export function createDefaultRegistry(): ConnectorRegistry {
  return new ConnectorRegistry()
    .register(new GreenhouseConnector())
    .register(new LeverConnector())
    .register(new AshbyConnector())
    .register(new JsonLdConnector())
    .register(new ManualUrlConnector());
}
