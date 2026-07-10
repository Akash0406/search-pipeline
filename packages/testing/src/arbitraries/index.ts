/**
 * Shared fast-check arbitrary factories for `foundation-discovery-core`.
 *
 * Generic, schema-independent arbitraries (URLs, domains, IP ranges) are
 * implemented here now. The domain-shaped arbitraries listed in the design's
 * Testing Strategy depend on canonical/contract schemas that are built in later
 * tasks, so they are declared as EXTENSION POINTS below rather than implemented
 * prematurely.
 *
 * Extension points (implement alongside the task that introduces the schema):
 *   - `arbParsedOpportunity`      — connectors + contracts (tasks 3.x / 8.x)
 *   - `arbOpportunitySourceSet`   — dedup, with identity collisions +
 *                                   first-party/aggregator mixes (task 10.2 / 10.10+)
 *   - `arbRedirectChain`          — SafeFetcher redirect handling (task 7.3 / 7.8)
 *   - `arbFetchResponse`          — size/content-type/redirect variation (task 7.8)
 *   - `arbRoleProfileOps`         — one-active invariant (task 6.4)
 *   - `arbExplorerState`          — filter/sort URL-state codec (task 3.2 / 3.4)
 *   - `arbTwoUserDataset`         — ownership isolation (task 4.8)
 *
 * When adding one, place it in its own module under `arbitraries/` and re-export
 * it here so consumers keep a single import surface (`@careerstack/testing`).
 */
export {
  arbDomain,
  arbUrl,
  arbHttpsUrl,
  arbLoopbackIpv4,
  arbPrivateIpv4,
  arbLinkLocalIpv4,
  arbMetadataIpv4,
  arbMulticastIpv4,
  arbReservedIpv4,
  arbLoopbackIpv6,
  arbUnspecifiedIpv6,
  arbLinkLocalIpv6,
  arbUniqueLocalIpv6,
  arbMetadataIpv6,
  arbIpAddress,
  arbPublicIpv4,
} from './network.js';
