# Implementation Plan: foundation-discovery-core

## Overview

This plan implements the `foundation-discovery-core` slice of CareerRadar AI (working app name **CareerStack**) as a pnpm + Turborepo TypeScript monorepo (`apps/web`, `apps/api`, `apps/worker`, and `packages/*`). Work proceeds in dependency-ordered vertical slices; each slice carries schema → backend → API → frontend → validation → states → tests through to wiring, so the slice functions end-to-end. Pure/deterministic domain logic (`packages/shared`, `packages/security`, `packages/connectors`) is exercised with **fast-check** property-based tests (minimum 100 runs each), tagged in code as:

```
// Feature: foundation-discovery-core, Property {n}: {text}
```

Test-related sub-tasks are marked with `*` and may be skipped for a faster MVP; core implementation sub-tasks are never optional.

## Correctness Properties (numbering used by PBT tasks below)

| # | Property | Validates |
|---|---|---|
| P1 | Canonical URL normalization is idempotent and deterministic (tracking params stripped, scheme/host case normalized) | Req 36.1 |
| P2 | Deduplication is idempotent (re-running over a resolved set changes nothing) | Req 36 |
| P3 | Deduplication is order-independent (permuting inputs yields the same grouping) | Req 36.2 |
| P4 | Fuzzy matches below `mergeThreshold` are never auto-merged; they route to review | Req 36.3 |
| P5 | When a group mixes first-party and aggregator sources, canonical fields come from the first-party source | Req 36.4 |
| P6 | Exact-identity: same `(source_type, external_id)` always resolves to one opportunity | Req 36.1 |
| P7 | Normalized-fingerprint hash is deterministic for identical normalized inputs | Req 36.1 |
| P8 | SSRF guard rejects private/loopback/link-local/unique-local/reserved/metadata IPs and re-validates every redirect target | Req 30.1, 30.2, 30.3 |
| P9 | SafeFetcher aborts when a response exceeds `maxBytes` | Req 31.4 |
| P10 | SafeFetcher aborts when the request exceeds `timeoutMs` | Req 31.5 |
| P11 | SafeFetcher never follows more than `maxRedirects` | Req 31.3 |
| P12 | SafeFetcher rejects content-types outside the allowed set | Req 31.6 |
| P13 | Domain deny-list beats allow-list; denied domains are rejected | Req 31.7 |
| P14 | Per-domain rate limit is never exceeded (over-budget requests deferred, not dropped) | Req 27.1, 27.2 |
| P15 | Conditional fetch: a 304 yields `notModified` and the pipeline skips re-download/re-parse | Req 26.3 |
| P16 | Normalization never fabricates absent facts (salary/work-rights/requirements/closing) → omitted or `uncertain` | Req 34.3, 34.4 |
| P17 | Normalization output always conforms to the canonical schema (valid → passes; invalid → review) | Req 33.1 |
| P18 | Every populated canonical fact carries exactly one evidence record with a valid extraction method | Req 34.1, 34.2 |
| P19 | Explorer filter correctness: every returned opportunity satisfies all active filters | Req 41.5 |
| P20 | Explorer sort correctness: result ordering is monotonic in the selected sort key | Req 42.2 |
| P21 | Explorer list projection never includes `description` | Req 40.3, 58.3 |
| P22 | URL-state round-trip: `decode(encode(s)) == s`; encoded state contains only filter/sort params | Req 44.1, 44.2, 44.3 |
| P23 | Ownership isolation: a user can never read or modify another user's resource | Req 54.1, 54.2, 10.5, 43.4 |
| P24 | One-active-profile invariant: a user has exactly one active profile after any profile operation | Req 10.2, 10.3, 10.4 |
| P25 | Save/dismiss reversibility: reversing returns to `none`; state is per-user | Req 43.3, 43.4 |
| P26 | Status vocabulary: any displayed status is a member of the fixed label set | Req 46.1, 46.2 |
| P27 | Connector-failure isolation: one connector throwing never terminates the worker or other connectors; ingested opportunities stay accessible | Req 55.1, 55.2, 20.4 |
| P28 | Retention: artifacts past the window are removed/anonymized while canonical opportunities remain accessible | Req 53.2, 53.3 |
| P29 | No third-party password is ever stored/accepted; magic links are stored hashed, single-use, and expire ≤ 15 min | Req 28.1, 4.5, 5.3, 5.4 |
| P30 | Export completeness: an export contains every category of the user's own data | Req 49.1 |

## Tasks

- [x] 1. Slice 0 — Monorepo, tooling, config, observability, and infra foundation
  - [x] 1.1 Initialize pnpm workspace + Turborepo with TypeScript `strict`
    - Create root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, base `tsconfig` and lint/format configs
    - Scaffold empty `apps/web`, `apps/api`, `apps/worker` and `packages/{ui,database,contracts,auth,config,observability,connectors,security,testing,shared}`
    - Enforce the boundary rule: `packages/shared` and `packages/connectors` must not import NestJS/Fastify/Next/Drizzle/ioredis (add lint rule)
    - _Requirements: 20.1_
    - _Design: Architecture → Monorepo layout, Boundary rule_
  - [x] 1.2 Implement `packages/config` typed loader
    - Load `brandName`, raw-source retention days, per-domain rate limits, fetch bounds, OAuth/magic-link settings from env with a typed schema
    - Provide a defined default for `brandName` and emit a config warning when unset
    - _Requirements: 1.1, 1.3, 53.1, 27.1, 31.3, 31.4, 31.5_
  - [ ]* 1.3 Write unit tests for the config loader
    - Assert `brandName` fallback + warning when unset; typed parsing/validation of bounds
    - _Requirements: 1.3_
  - [x] 1.4 Implement `packages/observability`
    - Structured logger, trace/metrics hooks, and a `correlationId` propagation utility used across API and worker
    - _Requirements: 24.1_
    - _Design: Architecture (trace/correlation propagation)_
  - [x] 1.5 Author `infra/` Docker Compose + migration runner
    - `docker-compose` for PostgreSQL + pgvector, Redis, and MinIO (S3-compatible); `.env.example`; a migrations runner script
    - _Requirements: 32.1_
    - _Design: Architecture (infrastructure)_
  - [x] 1.6 Scaffold `packages/testing`
    - fast-check arbitrary factories, fixture loader, and a shared test harness/config (100-run default for property tests)
    - _Requirements: 20.1_
    - _Design: packages/testing_

- [x] 2. Slice 1 — Database package: Drizzle schema and migrations
  - [x] 2.1 Set up `packages/database`
    - Drizzle client/config, migration tooling, and Postgres enum types (`source_type` lowercase, `extraction_method` uppercase, `opportunity_status`)
    - _Requirements: 33.1_
    - _Design: Data Models (conventions, enums)_
  - [x] 2.2 Implement identity/session/audit schema
    - `users`, `accounts` (no password column), `magic_link_tokens` (hash+expiry+used_at), `sessions`, `user_preferences`, `audit_logs` (INSERT-only, no update/delete grant)
    - _Requirements: 4.4, 4.5, 5.4, 6.1, 8.1, 9.4, 28.1_
    - _Design: Data Models → Identity, Sessions, Preferences, Audit_
  - [x] 2.3 Implement role-profile schema
    - `role_profiles`, `role_profile_titles`, `role_profile_skills`, `role_profile_locations`, `role_profile_preferences` with `user_id` ownership indexes
    - _Requirements: 10.1, 11.3, 12.3, 13.3, 14.3, 15.2, 16.1_
    - _Design: Data Models → Role Profiles_
  - [x] 2.4 Implement connector/ingestion schema
    - `connectors`, `connector_configs`, `connections`, `connector_runs`, `connector_checkpoints`, `raw_artifacts` (unique `(connection_id, source_url, content_hash)`), `parser_definitions`, `parser_runs`
    - _Requirements: 24.1, 26.1, 32.2, 35.3, 48.1_
    - _Design: Data Models → Connectors/Runs/Checkpoints, Raw Artifacts & Parsers_
  - [x] 2.5 Implement canonical opportunity + provenance schema
    - `opportunities` (reserved `match_features`/`embedding` never written; explorer indexes), `opportunity_locations`, `opportunity_requirements`, `opportunity_skills`, `opportunity_content`, `opportunity_sources` (unique `(source_type, external_id)`), `opportunity_evidence`, `content_revisions`, `duplicate_groups`
    - _Requirements: 32.1, 33.2, 33.3, 34.1, 36.1, 37.1, 39.2, 58.3_
    - _Design: Data Models → Canonical Opportunity Model & Provenance, Indexing strategy_
  - [x] 2.6 Implement per-user state, review, exports, outbox, flags schema
    - `opportunity_user_state` (PK `(user_id, opportunity_id)`), `review_queue_items`, `exports`, `outbox_events`, `feature_flags`
    - _Requirements: 35.1, 43.4, 49.1_
    - _Design: Data Models → Per-User State, Review Queue, Exports, Outbox, Flags_
  - [x] 2.7 Generate initial migration + ownership-scoped repository base
    - Emit the first migration; implement a repository base whose every user-scoped query requires an `ownerId` and adds `WHERE user_id = :ownerId`
    - _Requirements: 54.1, 54.2, 54.3_
    - _Design: Auth §6 (ownership at repository layer)_
  - [ ]* 2.8 Write integration test for schema
    - Migrations apply cleanly on a fresh DB; audit_logs reject UPDATE/DELETE via app role; unique constraints enforce fetch/exact-identity idempotency
    - _Requirements: 9.4, 32.1, 36.1_

- [x] 3. Slice 2 — Contracts package (Zod + OpenAPI)
  - [x] 3.1 Define shared request/response schemas
    - Zod schemas for auth, role-profile, connection, opportunity list/detail, save/dismiss, admin, and privacy DTOs; standard error envelope; cursor pagination envelope; emit OpenAPI
    - _Requirements: 33.1_
    - _Design: API §7 (contracts as single source of truth)_
  - [x] 3.2 Implement pure explorer filter/sort schema + `encodeExplorerState`/`decodeExplorerState`
    - Filter dimensions and sort keys per design; encode only filter/sort params, never private state
    - _Requirements: 41.1, 41.2, 41.3, 41.4, 42.1, 44.1, 44.3_
    - _Design: API §7 (filter/sort), Frontend §8 (URL state)_
  - [ ]* 3.3 Write contract tests for schemas
    - Valid payloads accepted, invalid rejected; OpenAPI generation snapshot is stable
    - _Requirements: 33.1_
  - [ ]* 3.4 Write property test for URL-state round-trip
    - **Property 22: URL-state round-trip + privacy** — `decode(encode(s)) == s`; encoded output holds only filter/sort params
    - _Requirements: 44.1, 44.2, 44.3_
    - _Properties: P22_

- [x] 4. Slice 3 — Auth package + AuthModule (OAuth+PKCE, magic link, sessions, admin, audit)
  - [x] 4.1 Implement framework-agnostic auth core (`packages/auth`)
    - Session issue/rotate/revoke, token hashing, CSRF double-submit, PKCE + signed single-use state, magic-link token generation/verification
    - _Requirements: 4.1, 5.1, 6.2, 8.1_
    - _Design: Auth §6_
  - [x] 4.2 Implement Google OAuth flow in AuthModule
    - `POST /auth/oauth/google/start` (state+PKCE, minimum scopes) and `GET /auth/oauth/google/callback` (validate state, exchange code, create/bind account, issue session)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 52.1, 52.2_
    - _Design: API §7 (Auth routes)_
  - [x] 4.3 Implement magic-link endpoints
    - `POST /auth/magic-link` (single-use, hashed, ≤15 min) and `GET /auth/magic-link/verify` (consume, reject expired/used with resend offer); no password auth path exists
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 4.4 Implement session endpoints + logout
    - `GET /me/sessions`, `DELETE /me/sessions/{id}`, `DELETE /me/sessions?others=true`, `POST /auth/logout`; timezone-aware timestamps
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 4.5 Implement admin guard, ownership guard, and auth auditing
    - Admin role guard (403 for non-admins), controller-level ownership guard complementing the repository check, append-only audit writes for sign-in/session/admin-access events
    - _Requirements: 8.2, 8.3, 8.4, 9.1, 9.2, 9.4, 54.1, 54.2_
  - [x] 4.6 Implement account deletion
    - `POST /privacy/delete-account`: explicit confirmation, delete/anonymize personal data + profiles + states + connections, invalidate all sessions, write audit event
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 4.7 Write property test for password/magic-link invariant
    - **Property 29: No third-party password stored + magic-link hashed/single-use/≤15 min**
    - _Requirements: 28.1, 4.5, 5.3, 5.4_
    - _Properties: P29_
  - [ ]* 4.8 Write property test for ownership isolation
    - **Property 23: Ownership isolation** — generated cross-user access attempts always deny/return not-found across profiles, sessions, connections, states, exports
    - _Requirements: 54.1, 54.2, 54.3_
    - _Properties: P23_
  - [ ]* 4.9 Write security/integration tests for auth
    - Non-admin denied (403) on admin route with audit recorded; CSRF token missing/mismatch rejected on state-changing requests
    - _Requirements: 8.3, 8.4, 9.2_
  - [ ]* 4.10 Write unit tests for auth edge cases
    - Expired/used magic link rejected; session revoke invalidates subsequent requests; revoke-others preserves current
    - _Requirements: 5.3, 6.2, 6.3_

- [x] 5. Checkpoint — foundation, database, contracts, and auth
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Slice 4 — Role Profiles module + UI
  - [x] 6.1 Implement RoleProfilesModule
    - CRUD + `activate`/`pause`/`resume`/`duplicate`; enforce one-active via `user_preferences.active_role_profile_id`; first profile auto-activates; ownership enforced
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 12.1, 12.2, 13.1, 13.2, 14.1, 14.2, 15.1, 15.3, 16.1, 16.3, 16.4, 17.1, 17.2, 17.3, 18.1, 18.2, 18.3, 19.1, 19.4_
    - _Design: API §7 (role-profile routes), Auth §6 (ownership)_
  - [~] 6.2 Build role-profile create/edit UI
    - Target/excluded titles, required/preferred skills, locations, work arrangement, employment type, seniority, optional salary, optional work-rights with pre-collection explainer; empty/loading/error states
    - _Requirements: 11.1, 12.1, 13.1, 13.2, 14.1, 14.2, 15.1, 16.1, 16.2, 56.1_
    - _Design: Frontend §8 (/app/profiles, required states)_
  - [~] 6.3 Wire active-profile switching + indicator
    - Activate action deactivates previous; delete-active and pause-active prompt for a new active selection; feed the shell's active-profile indicator
    - _Requirements: 10.3, 18.2, 19.2, 19.3_
    - _Design: Frontend §8 (app shell active-profile indicator)_
  - [ ]* 6.4 Write property test for the one-active invariant
    - **Property 24: One-active-profile invariant** — after any sequence of create/activate/pause/duplicate/delete operations, exactly one profile is active
    - _Requirements: 10.2, 10.3, 10.4_
    - _Properties: P24_
  - [ ]* 6.5 Write integration tests for profile operations
    - Duplicate leaves active unchanged with a distinct name; pausing the active profile requires switching; deleting the active profile prompts new-active selection; foreign profile access denied
    - _Requirements: 17.2, 17.3, 18.2, 19.3, 19.4_
  - [ ]* 6.6 Write unit tests for preference semantics
    - Salary unspecified ≠ 0; work-rights optional/private; no work-rights inference from nationality/location
    - _Requirements: 15.3, 16.3, 16.4, 16.5_

- [x] 7. Slice 5 — Security package (canonical URL, SSRF guard, SafeFetcher, rate limiter, sanitizer)
  - [x] 7.1 Implement canonical URL normalizer (pure)
    - Strip tracking params, normalize scheme/host casing, resolve to a stable first-party URL; used as an identity key
    - _Requirements: 36.1_
    - _Design: Normalization §3 (canonical URL resolution)_
  - [x] 7.2 Implement SSRF guard (pure resolver policy)
    - DNS resolution + IP blocklist (private/loopback/link-local/unique-local/reserved/multicast/metadata), IP pinning against rebinding, redirect-target re-validation hook
    - _Requirements: 30.1, 30.2, 30.3_
    - _Design: Security §2 (SSRF guard)_
  - [x] 7.3 Implement SafeFetcher
    - Domain deny/allow policy (deny beats allow), robots handling, descriptive User-Agent, conditional headers, timeout, redirect cap with per-hop SSRF re-check, content-type validation, streamed max-bytes cap
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 31.7, 26.3, 28.2, 28.3, 28.4_
    - _Design: Security §2 (enforcement pipeline)_
  - [x] 7.4 Implement per-domain rate limiter + backoff
    - Redis token-bucket keyed by registrable domain shared across connections; over-budget requests deferred; exponential backoff with jitter on throttle/5xx
    - _Requirements: 27.1, 27.2, 27.3_
    - _Design: Security §2 (rate limiting), Worker §9_
  - [x] 7.5 Implement HTML sanitizer
    - Sanitize opportunity description HTML; never render raw markup (XSS defense)
    - _Requirements: 33.4_
    - _Design: Data Models (opportunity_content sanitized), Frontend §8_
  - [ ]* 7.6 Write property test for canonical URL normalization
    - **Property 1: Canonical URL idempotence + determinism** — `normalize(normalize(u)) == normalize(u)`; equivalent URLs normalize identically
    - _Requirements: 36.1_
    - _Properties: P1_
  - [ ]* 7.7 Write property test for the SSRF guard
    - **Property 8: SSRF rejection + redirect re-validation** — any private/loopback/link-local/reserved/metadata target (initial or via redirect) is rejected
    - _Requirements: 30.1, 30.2, 30.3_
    - _Properties: P8_
  - [ ]* 7.8 Write property tests for SafeFetch bounds
    - **Property 9: maxBytes bound**, **Property 10: timeout bound**, **Property 11: maxRedirects bound**, **Property 12: content-type rejection**, **Property 13: domain deny-beats-allow**
    - _Requirements: 31.3, 31.4, 31.5, 31.6, 31.7_
    - _Properties: P9, P10, P11, P12, P13_
  - [ ]* 7.9 Write property test for the rate limiter
    - **Property 14: Per-domain rate-limit bound** — request count within any window never exceeds the configured limit; excess is deferred, not dropped
    - _Requirements: 27.1, 27.2_
    - _Properties: P14_
  - [ ]* 7.10 Write property test for conditional fetch
    - **Property 15: Conditional-fetch 304 skip** — a 304 response yields `notModified` and no body re-download
    - _Requirements: 26.3_
    - _Properties: P15_
  - [ ]* 7.11 Write security test for the sanitizer
    - Known XSS vectors (script/onerror/js: URLs) are stripped from description HTML
    - _Requirements: 33.4_

- [x] 8. Slice 6 — Connector framework + Greenhouse/Lever/Ashby/JSON-LD/manual-URL connectors
  - [x] 8.1 Define `OpportunityConnector` interface + registry (`packages/connectors`)
    - `SourceType` union, `DiscoveryRef`/`FetchResult`/`ParsedOpportunity`/`Checkpoint`/`HealthStatus`/`ConnectorContext`; connector registry allowing new sources without scheduler changes; connectors fetch only via injected `SafeFetcher`
    - _Requirements: 20.1, 20.3_
    - _Design: Connector Framework §1_
  - [x] 8.2 Implement GreenhouseConnector
    - Public boards JSON; page `discover`; `parse` maps structured fields with `STRUCTURED_DATA` evidence; `isFirstParty = true`
    - _Requirements: 21.1, 21.2, 21.3_
    - _Design: Connector Framework §1 (concrete connectors)_
  - [x] 8.3 Implement LeverConnector
    - Public postings JSON; structured mapping; `isFirstParty = true`
    - _Requirements: 21.1, 21.2, 21.3_
  - [x] 8.4 Implement AshbyConnector
    - Public job-board API (list + detail); structured mapping; `isFirstParty = true`
    - _Requirements: 21.1, 21.2, 21.3_
  - [x] 8.5 Implement JsonLdConnector
    - Extract `application/ld+json` `@type: JobPosting`; map schema.org fields; record health issue and fabricate nothing when no valid posting is present; `isFirstParty = true`
    - _Requirements: 22.1, 22.2, 22.3_
  - [x] 8.6 Implement ManualUrlConnector
    - Single-URL fetch via SafeFetcher (same controls); JSON-LD path when present else best-effort `PARSER`; on parse/validation failure store the raw artifact and route to the Review_Queue
    - _Requirements: 23.1, 23.2, 23.3_
  - [ ]* 8.7 Write contract/fixture tests for parsers
    - Recorded Greenhouse/Lever/Ashby/JSON-LD fixtures parse to expected `ParsedOpportunity` shapes; no ATS credentials/passwords collected
    - _Requirements: 21.1, 21.2, 21.5, 22.1_
  - [ ]* 8.8 Write property test for parser no-fabrication
    - **Property 16: Normalization no-fabrication (parse layer)** — absent source facts stay undefined/`uncertain`, never guessed
    - _Requirements: 34.3, 34.4_
    - _Properties: P16_
  - [ ]* 8.9 Write unit test for JSON-LD empty case
    - Page without valid JobPosting → health issue recorded, zero opportunities produced
    - _Requirements: 22.2_

- [x] 9. Checkpoint — role profiles, security, and connectors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Slice 7 — Ingestion pipeline (worker): queues, artifact storage, parse, normalize, dedup, outbox, closure/expiry, retention
  - [x] 10.1 Implement normalization mapper (pure, `packages/shared`)
    - Map `ParsedOpportunity` → canonical field values with one `Evidence` per fact; field normalization (title/location/workplace/employment/seniority/salary); leave match/analysis fields untouched
    - _Requirements: 33.1, 33.2, 33.3, 34.1, 34.2, 34.3, 34.4_
    - _Design: Normalization §3_
  - [x] 10.2 Implement deduplication engine (pure, `packages/shared`)
    - Exact-identity → normalized-fingerprint → fuzzy cascade; first-party-wins field selection; low-confidence fuzzy routes to review; deterministic + order-independent
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 37.1_
    - _Design: Deduplication §4_
  - [x] 10.3 Set up BullMQ queues, worker bootstrap, scheduler, graceful shutdown
    - Queues `discovery|fetch|parse|normalize|dedup|expiry-check|retention-cleanup|outbox-dispatch`; scheduler runs discovery for active, non-paused connections only; SIGTERM drain; correlation IDs threaded
    - _Requirements: 20.2, 25.1, 56.1_
    - _Design: Worker §9_
  - [x] 10.4 Implement discovery + fetch stages with raw-artifact storage
    - `connector.discover` → per-ref fetch via SafeFetcher (rate limit, conditional GET, checkpoints); store `Raw_Artifact` in MinIO/S3 before parsing with connection/source/timestamp/`retention_until`; 304 short-circuits
    - _Requirements: 26.1, 26.2, 26.3, 27.1, 32.1, 32.2, 32.3_
    - _Design: High-level ingestion flow, Worker §9_
  - [x] 10.5 Implement parse stage + review routing
    - `connector.parse`, record `parser_runs`; schema-invalid records store artifact and enter `review_queue_items` with a failure reason
    - _Requirements: 35.1, 35.2, 35.3, 48.1_
  - [x] 10.6 Implement normalize → canonical-URL → dedup → persist wiring
    - Run normalization + canonical URL resolution + dedup; persist canonical opportunity, `opportunity_sources`, evidence transactionally with the outbox; retain all sources after merge
    - _Requirements: 36.2, 37.1, 37.2, 37.3_
    - _Design: High-level ingestion flow, Worker §9 (transactional outbox)_
  - [x] 10.7 Implement expiry/closure + content-revision detection
    - `expiry-check` sets Closed/Removed/Expired from source signals, marks ambiguous closure uncertain; record `content_revisions` (changed fields + timestamps); update `last_updated_at`
    - _Requirements: 38.1, 38.2, 38.3, 39.1, 39.2, 39.3_
  - [x] 10.8 Implement retention-cleanup + outbox-dispatch jobs
    - `retention-cleanup` deletes/anonymizes artifacts past the window keeping canonical opportunities accessible; `outbox-dispatch` publishes events at-least-once
    - _Requirements: 53.1, 53.2, 53.3_
  - [x] 10.9 Implement connector-error isolation + DLQ
    - Errors captured against the `Connection`/`connector_run` without killing the worker; exhausted retries move to the queue DLQ; other connectors keep running
    - _Requirements: 20.4, 24.3, 55.1, 55.2, 55.3_
  - [ ]* 10.10 Property test — **Property 2: Dedup idempotence** — _Requirements: 36_ — _Properties: P2_
  - [ ]* 10.11 Property test — **Property 3: Dedup order-independence** — _Requirements: 36.2_ — _Properties: P3_
  - [ ]* 10.12 Property test — **Property 4: Dedup confidence-gating (low-confidence → review)** — _Requirements: 36.3_ — _Properties: P4_
  - [ ]* 10.13 Property test — **Property 5: Dedup first-party preference** — _Requirements: 36.4_ — _Properties: P5_
  - [ ]* 10.14 Property test — **Property 6: Exact-identity uniqueness** — _Requirements: 36.1_ — _Properties: P6_
  - [ ]* 10.15 Property test — **Property 7: Normalized-fingerprint determinism** — _Requirements: 36.1_ — _Properties: P7_
  - [ ]* 10.16 Property test — **Property 16: Normalization no-fabrication** — _Requirements: 34.3, 34.4_ — _Properties: P16_
  - [ ]* 10.17 Property test — **Property 17: Normalization schema-conformance** — _Requirements: 33.1_ — _Properties: P17_
  - [ ]* 10.18 Property test — **Property 18: Evidence completeness per populated fact** — _Requirements: 34.1, 34.2_ — _Properties: P18_
  - [ ]* 10.19 Property test — **Property 27: Connector-failure isolation** — _Requirements: 55.1, 55.2, 20.4_ — _Properties: P27_
  - [ ]* 10.20 Property test — **Property 28: Retention removes artifacts, keeps canonical** — _Requirements: 53.2, 53.3_ — _Properties: P28_
  - [ ]* 10.21 Integration test — end-to-end pipeline from fixture to persisted canonical
    - Fixture → artifact stored → parsed → normalized → deduped → canonical + provenance persisted; provenance and raw-artifact references retained after merge
    - _Requirements: 32.1, 33.1, 37.1, 37.3_

- [ ] 11. Slice 8 — Opportunities module + explorer UI + detail
  - [x] 11.1 Implement OpportunitiesModule endpoints
    - `GET /opportunities` (filters + sort + cursor, projection excludes `description`), `GET /opportunities/{id}` (full detail + sources + evidence), `PUT/DELETE /opportunities/{id}/save` and `/dismiss` (per-user, ownership-scoped)
    - _Requirements: 40.3, 43.1, 43.2, 43.3, 43.4, 45.1, 45.2, 58.3_
    - _Design: API §7 (opportunities routes)_
  - [x] 11.2 Implement filter + sort query builder (repository)
    - Translate filter/sort DTO into indexed queries (`status,last_updated_at desc`, company, closing_at, first_seen_at, fingerprint, per-user state); cursor pagination
    - _Requirements: 41.1, 41.2, 41.3, 41.4, 41.5, 42.1, 42.2, 42.3, 58.1_
    - _Design: Data Models → Indexing strategy_
  - [~] 11.3 Build explorer UI (card/list/table)
    - Three view modes; switching view preserves filters/sort/result set; paginate/virtualize collections; never fetch descriptions in list; empty/loading/error states
    - _Requirements: 40.1, 40.2, 40.3, 40.4, 56.1_
    - _Design: Frontend §8 (explorer)_
  - [~] 11.4 Wire filters/sort to URL state + save/dismiss
    - Filters + sort serialize via `encode/decodeExplorerState`; restore from URL; optimistic per-user save/dismiss with reversal
    - _Requirements: 41.5, 42.2, 43.1, 43.2, 43.3, 44.1, 44.2_
    - _Design: Frontend §8 (URL state)_
  - [~] 11.5 Build opportunity detail UI
    - Full info + current status + sanitized description; contributing sources with evidence; first-party contributors marked; external links open session-isolated (`rel="noopener noreferrer" target="_blank"`); reserved region for future match/analysis
    - _Requirements: 45.1, 45.2, 45.3, 45.4, 45.5_
    - _Design: Frontend §8 (opportunity detail)_
  - [x] 11.6 Implement status mapping + timezone date formatter
    - Overlay per-user Saved/Dismissed on canonical status; render the fixed display vocabulary only; single tz-aware date formatter with exact value on demand
    - _Requirements: 46.1, 46.2, 46.3_
    - _Design: Canonical types §5, Frontend §8 (timezone/date handling)_
  - [ ]* 11.7 Property test — **Property 19: Filter correctness** — every returned item satisfies all active filters — _Requirements: 41.5_ — _Properties: P19_
  - [ ]* 11.8 Property test — **Property 20: Sort correctness** — ordering monotonic in the selected sort key — _Requirements: 42.2_ — _Properties: P20_
  - [ ]* 11.9 Property test — **Property 21: List projection excludes description** — _Requirements: 40.3, 58.3_ — _Properties: P21_
  - [ ]* 11.10 Property test — **Property 25: Save/dismiss reversibility (per-user)** — _Requirements: 43.3, 43.4_ — _Properties: P25_
  - [ ]* 11.11 Property test — **Property 26: Status vocabulary closed set** — _Requirements: 46.1, 46.2_ — _Properties: P26_
  - [ ]* 11.12 Integration test for opportunities API
    - List honors filters/sort/cursor with no description; detail returns sources + evidence; save/dismiss scoped per user (cross-user leakage denied)
    - _Requirements: 40.3, 43.4, 45.2_

- [~] 12. Checkpoint — ingestion pipeline and explorer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Slice 9 — Admin connector-health + review queue
  - [x] 13.1 Implement AdminModule endpoints
    - `GET /admin/connector-health`, `GET /admin/runs`, `GET /admin/parser-failures`, `GET /admin/review-queue`; admin-guarded; access audited
    - _Requirements: 47.1, 47.2, 47.3, 48.1, 48.2, 48.3_
    - _Design: API §7 (admin routes)_
  - [~] 13.2 Build admin connector-health UI
    - `/admin/connector-health`: per-connection health, recent runs with counts/failure reasons, parser failures, and the review queue
    - _Requirements: 47.1, 47.2, 48.1, 48.2_
    - _Design: Frontend §8 (/admin/connector-health)_
  - [ ]* 13.3 Write security/integration tests for admin
    - Non-admin denied (403) on every admin route; admin access writes an audit event
    - _Requirements: 47.3, 48.3_

- [ ] 14. Slice 10 — Privacy: export, delete, disconnect, retention surface
  - [x] 14.1 Implement PrivacyModule endpoints
    - `POST /privacy/export` + `GET /privacy/export/{id}` (async + status), `POST /privacy/delete-data` (confirm-gated), `POST /connections/{id}/disconnect` (revoke OAuth, stop scheduling, keep opportunities), retention-policy surface
    - _Requirements: 49.1, 49.2, 49.3, 50.2, 51.1, 51.2, 51.3, 53.1, 56.1_
    - _Design: API §7 (privacy routes)_
  - [x] 14.2 Implement export worker job
    - Assemble the user's personal data, role profiles, saved/dismissed states, and connection configuration into an export; deliver via signed URL to the owner only
    - _Requirements: 49.1, 49.2_
  - [~] 14.3 Build privacy UI
    - Export status, disconnect source, delete-data/account flows with explicit confirmation and live long-running status via SSE
    - _Requirements: 49.3, 50.2, 51.1, 56.1, 56.2_
    - _Design: Frontend §8 (/app/settings/privacy)_
  - [ ]* 14.4 Property test — **Property 30: Export completeness** — export contains every category of the user's own data — _Requirements: 49.1_ — _Properties: P30_
  - [ ]* 14.5 Write integration tests for delete/disconnect
    - Delete-account anonymizes/deletes data, invalidates sessions, writes audit; disconnect stops scheduling and keeps previously ingested opportunities accessible
    - _Requirements: 7.2, 7.3, 51.2, 51.3_
  - [ ]* 14.6 Write security test for export ownership
    - **Property 23: Ownership isolation (exports)** — export artifacts are retrievable only by the requesting owner
    - _Requirements: 49.2, 54.3_
    - _Properties: P23_

- [ ] 15. Slice 11 — App shell, public surface, PWA, accessibility
  - [x] 15.1 Build public landing + public routes
    - Landing plus `/features /how-it-works /sources /security /privacy /terms` as RSC, responsive across mobile/tablet/desktop, sign-in CTA, brand name from `config.brandName` (default + warning when unset)
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4_
    - _Design: Frontend §8 (routes)_
  - [x] 15.2 Build authenticated app shell
    - Persistent sidebar (desktop) / bottom nav (mobile), command palette (keyboard + visible control), always-visible active-profile indicator, theme switcher (light/dark/system, persisted, no full reload)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
    - _Design: Frontend §8 (app shell)_
  - [x] 15.3 Implement PWA shell
    - Web app manifest + service worker offering an offline-fallback shell for the public surface
    - _Requirements: 2.5_
  - [~] 15.4 Implement SSE `/events` + client invalidation
    - Server-Sent Events for run status, opportunity changes, and export status; TanStack Query invalidation on the client
    - _Requirements: 56.1, 56.2_
    - _Design: API §7 (Live /events), Frontend §8_
  - [ ]* 15.5 Write accessibility tests
    - Keyboard navigation for command palette and navigation; accessible dialog roles/labels/focus management; reduced-motion honored; automated axe checks on key surfaces
    - _Requirements: 57.1, 57.2, 57.3, 57.4_

- [ ] 16. Slice 12 — CI/CD and end-to-end wiring
  - [~] 16.1 Wire the API application end-to-end
    - Bootstrap `apps/api` with all modules and cross-cutting middleware: request-ID echo, trace correlation, session auth + CSRF, ownership guards, `Idempotency-Key` handling, cursor pagination, standard error envelope
    - _Requirements: 54.3_
    - _Design: API §7 (cross-cutting middleware)_
  - [~] 16.2 Wire the web application end-to-end
    - Connect `apps/web` to the API with session auth and SSE so the full flow works: land → register → create profile → connect source / add company → browse → filter/sort → save/dismiss → export → delete
    - _Requirements: 2.1, 3.4, 40.1, 43.1, 49.1_
  - [~] 16.3 Add CI pipeline configuration
    - Lint, typecheck, unit + property tests (fast-check ≥ 100 runs), contract/fixture tests, migration check, and build for all apps/packages
    - _Requirements: 20.1_
  - [ ]* 16.4 Write end-to-end (Playwright) test for the MVP flow
    - register → create profile → connect source → browse/filter/sort → save/dismiss → export → account deletion
    - _Requirements: 2.1, 4.2, 10.1, 21.2, 40.1, 41.5, 43.1, 49.1, 7.1_
  - [ ]* 16.5 Write end-to-end reliability test
    - **Property 27: Connector-failure isolation (system level)** — with one connector failing, the explorer stays available and other connectors keep running
    - _Requirements: 55.1, 55.2, 55.3_
    - _Properties: P27_

- [~] 17. Final checkpoint — full slice wired end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Sub-tasks marked with `*` are optional (tests) and can be skipped for a faster MVP; top-level tasks and non-`*` sub-tasks are core and must be implemented.
- Property-based tests use fast-check (minimum 100 runs) and are tagged `// Feature: foundation-discovery-core, Property {n}: {text}`. Pure, adapter-free logic lives in `packages/shared`, `packages/security`, and `packages/connectors` to keep it property-testable.
- Each task references specific requirement clauses and, where relevant, a design section (`_Design:_`) and/or correctness property (`_Properties:_`) for traceability.
- Checkpoints (tasks 5, 9, 12, 17) provide incremental validation gates.
- Hard_Blocker invariants (no third-party passwords, never fabricate data, cross-user isolation) are enforced in code and locked by Properties P16, P18, P23, and P29.
- The design's on-disk `Correctness Properties`/`Testing Strategy` sections are not present as standalone headings; property numbering (P1–P30) above is derived from the design's stated invariants and the requirement clauses they protect.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "2.6"] },
    { "id": 5, "tasks": ["2.7", "3.1"] },
    { "id": 6, "tasks": ["2.8", "3.2", "7.1", "7.2", "7.5"] },
    { "id": 7, "tasks": ["3.3", "3.4", "7.3", "7.4", "8.1"] },
    { "id": 8, "tasks": ["4.1", "7.6", "7.7", "7.8", "7.9", "7.10", "7.11", "8.2", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 9, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "8.7", "8.8", "8.9"] },
    { "id": 10, "tasks": ["4.7", "4.8", "4.9", "4.10", "10.1", "10.2"] },
    { "id": 11, "tasks": ["6.1", "10.3", "10.4"] },
    { "id": 12, "tasks": ["6.2", "6.3", "10.5", "10.6"] },
    { "id": 13, "tasks": ["6.4", "6.5", "6.6", "10.7", "10.8", "10.9"] },
    { "id": 14, "tasks": ["10.10", "10.11", "10.12", "10.13", "10.14", "10.15", "10.16", "10.17", "10.18", "10.19", "10.20", "10.21", "11.1", "11.2"] },
    { "id": 15, "tasks": ["11.3", "11.4", "11.5", "11.6", "13.1", "14.1", "14.2"] },
    { "id": 16, "tasks": ["11.7", "11.8", "11.9", "11.10", "11.11", "11.12", "13.2", "13.3", "14.3", "14.4", "14.5", "14.6", "15.1", "15.2", "15.3", "15.4"] },
    { "id": 17, "tasks": ["15.5", "16.1", "16.2"] },
    { "id": 18, "tasks": ["16.3", "16.4", "16.5"] }
  ]
}
```
