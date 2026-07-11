# Requirements Document

## Introduction

CareerRadar AI (product brand, working app name "CareerStack") is a personal career-opportunity intelligence platform. This specification, `foundation-discovery-core`, covers the foundational slice of the platform: the application shell and public surface, passwordless authentication, role profiles, source connectors, opportunity ingestion and processing, and a read-only opportunity explorer, plus a basic admin connector-health view.

The platform is initially Australia-focused, delivered as a responsive web application and Progressive Web App (PWA). Architecturally it is a modular monolith with asynchronous workers. This spec establishes the data model, ingestion pipeline, and browsing experience that later specs (matching engine, AI analysis, alerts, applications, documents, analytics) will build upon.

The brand/display name of the application MUST be configurable from a central configuration source so the working name ("CareerStack") and the product name ("CareerRadar AI") can be changed without code edits scattered across the codebase.

This document uses EARS-format acceptance criteria grouped by capability. PRD requirement identifiers (AUTH-_, PROF-_, SRC-_, OPP-_, PRIV-_, RES-_, UX-_, SEC-_, A11Y-_, PERF-_) are preserved where they map, and priorities (P0/P1/P2) are noted per requirement.

### Personas

- **Primary — Technical job seeker**: software, cloud, data, AI, and engineering professional tracking multiple role categories who wants early discovery of relevant opportunities.
- **Secondary — Graduate / international student**: work-rights sensitive user who needs entry-level roles and clear, private handling of work-rights data.
- **Tertiary — Career transitioner**: user seeking semantic matching and skills-gap insight (matching itself is out of scope here, but the model must not preclude it).

### Priority Legend

- **P0**: Must ship in the first release of this slice.
- **P1**: Should ship in this slice; may follow shortly after P0.
- **P2**: Planned/future; noted here for model completeness but not required to ship.

## Glossary

- **CareerStack / CareerRadar AI**: The application. The display/brand name is read from central configuration (`brandName`).
- **System**: The CareerStack platform as a whole, including web frontend, API, and asynchronous workers, unless a more specific component is named.
- **User**: An authenticated end user of the platform (job seeker persona).
- **Admin**: A user holding the separate administrative role, with access to operational/health views.
- **Role_Profile**: A named set of a user's career preferences (target/excluded titles, skills, location, work arrangement, employment type, seniority, salary, optional work-rights constraints). A user may have multiple Role_Profiles but exactly one Active_Role_Profile.
- **Active_Role_Profile**: The single Role_Profile currently selected as active for a user; it contextualizes the explorer and UI.
- **Connector**: A pluggable component that discovers, fetches, parses, health-checks, and checkpoints opportunity data from a specific Source type (e.g., Greenhouse, Lever, Ashby, JSON-LD career page, manual URL).
- **Connection**: A user-configured, running instance of a Connector bound to a specific company/domain/board.
- **Source**: The origin of opportunity data (an ATS board, a company career page, a manually submitted URL, etc.).
- **First_Party_Source**: A source operated by the hiring company itself or its official ATS (e.g., Greenhouse/Lever/Ashby board, company career page), as opposed to a third-party aggregator. Preferred per the data-source hierarchy.
- **Raw_Artifact**: The unmodified fetched content (HTTP response body, JSON payload, HTML, headers/metadata) stored before parsing, retained per the configurable retention policy.
- **Canonical_Opportunity**: The single deduplicated representation of a job opportunity in the shared canonical schema. One Canonical_Opportunity may be backed by multiple Opportunity_Source records.
- **Opportunity_Source**: A record linking a Canonical_Opportunity to a specific Source/Raw_Artifact from which it was derived, preserving traceability after merging/deduplication.
- **Evidence**: Provenance attached to an extracted fact, comprising the source artifact reference, the source text, the extraction method (STRUCTURED_DATA, RULE, PARSER, LLM, USER), and a confidence value.
- **Extraction_Method**: One of STRUCTURED_DATA, RULE, PARSER, LLM, USER, describing how a fact was derived.
- **Deduplication**: The process of collapsing multiple Opportunity_Source records into one Canonical_Opportunity via exact-identity, normalized-fingerprint, and fuzzy matching stages.
- **Duplicate_Group**: The set of Opportunity_Source records and Canonical_Opportunities associated by deduplication.
- **Hard_Blocker**: A prohibited data-collection action the System must never perform (e.g., requesting third-party platform passwords, bypassing CAPTCHA/rate limits/anti-bot/auth, scraping private logged-in content, auto-applying).
- **Review_Queue**: An admin-visible queue holding records that failed parsing/validation or that require human adjudication (invalid records, closure ambiguity, uncertain duplicates).
- **Opportunity_Status**: A user-facing status label from the fixed set: New, Active, Closing soon, Closed, Expired, Removed, Needs review, Duplicate, Saved, Applied, Dismissed.
- **PWA**: Progressive Web App delivery of the responsive web application.
- **SSRF**: Server-Side Request Forgery; the System must prevent connector requests to private IP ranges and cloud metadata endpoints.

## Out of Scope (This Spec)

The following are explicitly OUT OF SCOPE for `foundation-discovery-core` and will be addressed in separate specs. The data model and UI in this spec MUST leave room for them but MUST NOT implement them:

- Match scoring and semantic matching engine.
- AI analysis of opportunities (fit analysis, summaries, skills-gap).
- Alerts and notifications.
- Application tracking / auto-apply (auto-apply is additionally a Hard_Blocker and is never built).
- Resume studio, cover letters, document generation.
- Interview preparation.
- Analytics beyond connector-health operational views.
- Password-based authentication.
- Full Gmail / email ingestion and parsing. Gmail MAY be referenced as a future source type, but email parsing is a later spec.
- Browser-extension capture beyond noting it as a future connector mode (SRC-010, P2).

## Requirements

---

## Capability A: Application Foundation & Public Surface

### Requirement 1: [A1] Configurable Brand Name (P0)

**User Story:** As a product owner, I want the application's display name to come from central configuration, so that the brand ("CareerRadar AI") or working name ("CareerStack") can change without scattered code edits.

#### Acceptance Criteria

1. THE System SHALL read the display brand name from a single central configuration value named `brandName`.
2. WHERE a page, document title, or UI component displays the application name, THE System SHALL render the value of `brandName`.
3. IF `brandName` is not set in configuration, THEN THE System SHALL fall back to a defined default value and record a configuration warning.

### Requirement 2: [A2] Public Landing Page and Core Public Routes (P0)

**User Story:** As a prospective user, I want a polished public landing page and core informational pages, so that I can understand the product before signing in.

#### Acceptance Criteria

1. THE System SHALL serve a public landing page at the home route without requiring authentication.
2. THE System SHALL serve public routes for features, how-it-works, sources, security, privacy, and terms without requiring authentication.
3. WHEN an unauthenticated visitor requests any public route, THE System SHALL render that route's content and a call-to-action to sign in.
4. THE System SHALL render the landing page as a responsive layout across mobile, tablet, and desktop viewport widths.
5. WHERE the application is installed as a PWA, THE System SHALL serve the public shell offline-fallback and a web app manifest.

### Requirement 3: [A3] Authenticated Application Shell (P0)

**User Story:** As an authenticated user, I want a consistent app shell with navigation and search, so that I can move through the application efficiently on any device.

#### Acceptance Criteria

1. WHILE a user is authenticated on a desktop viewport, THE System SHALL display a persistent sidebar navigation.
2. WHILE a user is authenticated on a mobile viewport, THE System SHALL display a bottom navigation bar.
3. THE System SHALL provide a command palette that opens via a keyboard shortcut and via a visible control.
4. THE System SHALL display an Active_Role_Profile indicator in the application shell at all times while authenticated (UX rule: user always knows active role profile).
5. THE System SHALL provide a theme switcher supporting light, dark, and system themes, and SHALL persist the user's selection.
6. WHEN a user selects a theme, THE System SHALL apply the selected theme without a full page reload.

---

## Capability B: Authentication & Sessions

### Requirement 4: [B1 / AUTH-001] Google OAuth Sign-In (P0)

**User Story:** As a user, I want to sign in with my Google account, so that I can access the application without managing a password.

#### Acceptance Criteria

1. WHEN a user chooses Google sign-in, THE System SHALL initiate an OAuth authorization flow requesting only the minimum scopes required for authentication (PRIV-004).
2. WHEN Google returns a valid authorization result, THE System SHALL establish an authenticated session for the corresponding user account.
3. IF the OAuth flow fails or is denied, THEN THE System SHALL return the user to the sign-in page with a descriptive, non-technical error message.
4. WHEN a first-time user completes Google sign-in, THE System SHALL create a user account associated with the verified Google identity.
5. THE System SHALL NOT request or store the user's Google account password (SRC-009 / SEC).

### Requirement 5: [B2 / AUTH-002] Email Magic-Link Sign-In (P0)

**User Story:** As a user, I want to sign in with an email magic link, so that I can access the application without a password or third-party account.

#### Acceptance Criteria

1. WHEN a user submits a valid email address for magic-link sign-in, THE System SHALL send a single-use, time-limited sign-in link to that address.
2. WHEN a user opens a valid, unexpired magic link, THE System SHALL establish an authenticated session for the associated account.
3. IF a magic link is expired or already used, THEN THE System SHALL reject the sign-in attempt and offer to send a new link.
4. THE System SHALL expire each magic link after a defined validity window not exceeding 15 minutes.
5. THE System SHALL NOT provide password-based authentication in this release.

### Requirement 6: [B3 / AUTH-003] Session View and Revocation (P0)

**User Story:** As a user, I want to view and revoke my active sessions, so that I can control access to my account.

#### Acceptance Criteria

1. THE System SHALL display to the user a list of that user's active sessions, including device/user-agent summary, approximate location where available, and last-active timestamp.
2. WHEN a user revokes a specific session, THE System SHALL invalidate that session so that its subsequent requests are unauthenticated.
3. WHEN a user chooses to revoke all other sessions, THE System SHALL invalidate every session for that user except the current one.
4. THE System SHALL display all session timestamps in the user's timezone with the exact timestamp available on demand (UX date rule).

### Requirement 7: [B4 / AUTH-004 / PRIV-002] Account Deletion (P0)

**User Story:** As a user, I want to delete my account and data, so that I can exercise control over my personal information.

#### Acceptance Criteria

1. WHEN a user requests account deletion, THE System SHALL require an explicit confirmation before proceeding (UX destructive-action rule).
2. WHEN account deletion is confirmed, THE System SHALL delete or irreversibly anonymize the user's personal data, Role_Profiles, saved/dismissed states, and connected sources.
3. WHEN account deletion completes, THE System SHALL invalidate all sessions for that user.
4. THE System SHALL record an auth audit event for account deletion (AUTH-006).

### Requirement 8: [B5 / AUTH-005] Separate Admin Role (P0)

**User Story:** As a platform operator, I want a separate admin role, so that operational views are restricted to authorized administrators.

#### Acceptance Criteria

1. THE System SHALL support an Admin role that is distinct from the standard user role.
2. WHERE a route or view is designated admin-only, THE System SHALL grant access only to users holding the Admin role.
3. IF a non-admin user requests an admin-only resource, THEN THE System SHALL deny access and return an authorization error.
4. WHEN an Admin accesses an admin-only view, THE System SHALL record an access audit event (AUTH-006).

### Requirement 9: [B6 / AUTH-006] Authentication Event Auditing (P0)

**User Story:** As a security-conscious operator, I want authentication events audited, so that account activity is traceable.

#### Acceptance Criteria

1. WHEN a sign-in succeeds or fails, THE System SHALL record an audit event capturing the account reference, method, timestamp, and outcome.
2. WHEN a session is created or revoked, THE System SHALL record an audit event.
3. WHEN an account is deleted, THE System SHALL record an audit event.
4. THE System SHALL store audit events such that they are attributable to a specific account and are not editable through standard user actions.

---

## Capability C: Role Profiles (PROF-*)

### Requirement 10: [C1 / PROF-001] Multiple Role Profiles With One Active (P0)

**User Story:** As a job seeker with several career directions, I want multiple role profiles with one active, so that I can browse opportunities in the context of a chosen direction.

#### Acceptance Criteria

1. THE System SHALL allow a user to create multiple Role_Profiles.
2. THE System SHALL maintain exactly one Active_Role_Profile per user at any time.
3. WHEN a user activates a Role_Profile, THE System SHALL set that profile as the Active_Role_Profile and deactivate the previously active one.
4. WHEN a user creates their first Role_Profile, THE System SHALL set that profile as the Active_Role_Profile.
5. THE System SHALL enforce per-resource ownership so that a user can view and modify only their own Role_Profiles (cross-user isolation).

### Requirement 11: [C2 / PROF-002] Target and Excluded Titles (P0)

**User Story:** As a job seeker, I want to specify target and excluded job titles, so that discovery reflects the roles I want and avoids ones I do not.

#### Acceptance Criteria

1. THE System SHALL allow a user to add, edit, and remove target titles on a Role_Profile.
2. THE System SHALL allow a user to add, edit, and remove excluded titles on a Role_Profile.
3. THE System SHALL persist target and excluded titles as part of the Role_Profile.

### Requirement 12: [C3 / PROF-003] Required and Preferred Skills (P0)

**User Story:** As a job seeker, I want to record required and preferred skills, so that my profile captures my capabilities and priorities.

#### Acceptance Criteria

1. THE System SHALL allow a user to record required skills and preferred skills on a Role_Profile.
2. THE System SHALL allow a user to edit and remove recorded skills.
3. THE System SHALL persist required and preferred skills as part of the Role_Profile.

### Requirement 13: [C4 / PROF-004] Location and Work-Arrangement Preferences (P0)

**User Story:** As a job seeker, I want to set location and work-arrangement preferences, so that discovery reflects where and how I want to work.

#### Acceptance Criteria

1. THE System SHALL allow a user to specify one or more preferred locations on a Role_Profile.
2. THE System SHALL allow a user to specify work-arrangement preferences from the set: on-site, hybrid, remote.
3. THE System SHALL persist location and work-arrangement preferences as part of the Role_Profile.

### Requirement 14: [C5 / PROF-005] Employment Type and Seniority (P0)

**User Story:** As a job seeker, I want to specify employment type and seniority, so that discovery reflects the kind and level of role I want.

#### Acceptance Criteria

1. THE System SHALL allow a user to specify preferred employment types (for example full-time, part-time, contract, internship) on a Role_Profile.
2. THE System SHALL allow a user to specify preferred seniority levels on a Role_Profile.
3. THE System SHALL persist employment type and seniority preferences as part of the Role_Profile.

### Requirement 15: [C6 / PROF-006] Salary Preferences (P1)

**User Story:** As a job seeker, I want to record salary preferences, so that discovery can reflect my compensation expectations.

#### Acceptance Criteria

1. THE System SHALL allow a user to record a salary preference including amount range, currency, and period on a Role_Profile.
2. THE System SHALL persist salary preferences as part of the Role_Profile.
3. WHERE a user has not provided a salary preference, THE System SHALL treat salary preference as unspecified rather than assuming a value.

### Requirement 16: [C7 / PROF-007] Optional Work-Rights Constraints (P0)

**User Story:** As an international student or visa holder, I want to optionally record work-rights constraints privately, so that I can express eligibility without being profiled by nationality.

#### Acceptance Criteria

1. THE System SHALL treat work-rights constraint data as optional on a Role_Profile.
2. THE System SHALL present a clear explanation of how work-rights data is used before a user provides it.
3. THE System SHALL treat work-rights data as private and SHALL restrict access to the owning user (and privileged access paths defined elsewhere).
4. THE System SHALL NOT infer immigration status or work rights from a user's nationality or location.
5. WHERE a user has not provided work-rights data, THE System SHALL treat work rights as unspecified.

### Requirement 17: [C8 / PROF-008] Duplicate Role Profile (P1)

**User Story:** As a job seeker, I want to duplicate an existing role profile, so that I can create a variant quickly.

#### Acceptance Criteria

1. WHEN a user duplicates a Role_Profile, THE System SHALL create a new Role_Profile containing copies of the source profile's preferences.
2. WHEN a Role_Profile is duplicated, THE System SHALL leave the Active_Role_Profile unchanged.
3. THE System SHALL give the duplicated Role_Profile a distinct name.

### Requirement 18: [C9 / PROF-009] Pause Role Profile (P1)

**User Story:** As a job seeker, I want to pause a role profile, so that I can temporarily stop it from driving discovery without deleting it.

#### Acceptance Criteria

1. WHEN a user pauses a Role_Profile, THE System SHALL mark that profile as paused and retain its data.
2. IF a user attempts to pause the Active_Role_Profile, THEN THE System SHALL require the user to activate a different profile first or SHALL prompt to select a new active profile.
3. WHEN a user resumes a paused Role_Profile, THE System SHALL restore it to an active-eligible state.

### Requirement 19: [C10 / PROF-010] Role Profile Ownership and Editing (P0)

**User Story:** As a job seeker, I want to edit and delete my role profiles safely, so that I stay in control of my preferences.

#### Acceptance Criteria

1. THE System SHALL allow a user to edit any of their own Role_Profiles.
2. WHEN a user deletes a Role_Profile, THE System SHALL require an explicit confirmation (UX destructive-action rule).
3. IF a user deletes the Active_Role_Profile and other profiles exist, THEN THE System SHALL prompt the user to select a new Active_Role_Profile.
4. IF a user attempts to access a Role_Profile they do not own, THEN THE System SHALL deny access (cross-user isolation).

---

## Capability D: Source Connectors (SRC-*)

### Requirement 20: [D1 / SRC-001] Connector Framework Interface (P0)

**User Story:** As a platform developer, I want a common connector interface, so that new sources can be added consistently and run reliably.

#### Acceptance Criteria

1. THE System SHALL define a connector interface exposing discover, fetch, parse, healthCheck, and checkpoint operations.
2. THE System SHALL execute Connector operations within asynchronous workers separate from the request-handling path.
3. WHERE a component implements the connector interface, THE System SHALL be able to run, monitor, and checkpoint it without connector-specific handling in the core scheduler.
4. IF a Connector operation throws an error, THEN THE System SHALL capture the error against that Connection without terminating the worker process.

### Requirement 21: [D2 / SRC-002] First-Party ATS Connectors — Greenhouse, Lever, Ashby (P0)

**User Story:** As a user, I want to connect first-party ATS boards, so that I discover opportunities directly from official company sources.

#### Acceptance Criteria

1. THE System SHALL provide Connectors for Greenhouse, Lever, and Ashby that fetch opportunities from their official/public feeds.
2. WHEN a user connects a Greenhouse, Lever, or Ashby board, THE System SHALL discover and fetch the opportunities published on that board.
3. THE System SHALL classify Greenhouse, Lever, and Ashby sources as First_Party_Source.
4. THE System SHALL prefer First_Party_Source records over aggregator records per the data-source hierarchy during processing.
5. THE System SHALL NOT collect or store credentials for the ATS beyond any official public feed access requirements, and SHALL NOT collect platform passwords (SRC-009).

### Requirement 22: [D3 / SRC-003] Generic JSON-LD JobPosting Connector (P0)

**User Story:** As a user, I want to connect a company career page that publishes JSON-LD, so that I discover opportunities from company sites without an ATS integration.

#### Acceptance Criteria

1. WHEN a user connects a company career page, THE System SHALL extract opportunities from valid schema.org JobPosting JSON-LD present on that page.
2. IF a page contains no valid JobPosting JSON-LD, THEN THE System SHALL record a health issue on the Connection and SHALL NOT fabricate opportunity data.
3. THE System SHALL classify a company career-page JSON-LD source as First_Party_Source.

### Requirement 23: [D4 / SRC-004] Manual URL Submission (P0)

**User Story:** As a user, I want to submit a job posting URL manually, so that I can capture opportunities the connectors did not discover.

#### Acceptance Criteria

1. WHEN a user submits a job posting URL, THE System SHALL fetch and attempt to parse that URL into an opportunity.
2. IF a submitted URL cannot be parsed into an opportunity, THEN THE System SHALL record the raw artifact and route the record to the Review_Queue (OPP-004).
3. THE System SHALL apply the same connector security controls (SSRF prevention, size/timeout limits, content-type validation) to manually submitted URLs as to automated fetches.

### Requirement 24: [D5 / SRC-005] Observable Connector Runs (P0)

**User Story:** As a user, I want to see when my connections run and what happened, so that I trust that discovery is working.

#### Acceptance Criteria

1. WHEN a Connector run starts, progresses, and completes, THE System SHALL record run status including start time, end time, counts of items fetched, and outcome.
2. THE System SHALL make the most recent run status of each Connection visible to its owning user.
3. IF a Connector run fails, THEN THE System SHALL record the failure reason against the run.

### Requirement 25: [D6 / SRC-006] Pause and Remove Connections (P0)

**User Story:** As a user, I want to pause or remove a connection, so that I control which sources are active.

#### Acceptance Criteria

1. WHEN a user pauses a Connection, THE System SHALL stop scheduling runs for that Connection and retain its configuration and previously ingested opportunities.
2. WHEN a user removes a Connection, THE System SHALL require an explicit confirmation (UX destructive-action rule) and SHALL stop scheduling runs for it.
3. WHEN a Connection is removed, THE System SHALL keep previously ingested Canonical_Opportunities accessible (reliability rule) unless the user also requests their removal.

### Requirement 26: [D7 / SRC-007] Connector Checkpoints (P0)

**User Story:** As a platform operator, I want connectors to checkpoint progress, so that runs are efficient and resumable.

#### Acceptance Criteria

1. THE System SHALL persist a checkpoint for each Connection representing its last successful fetch position or state.
2. WHEN a Connector run resumes or repeats, THE System SHALL use the stored checkpoint to avoid redundant reprocessing where the source supports it.
3. WHERE a source supports conditional requests, THE System SHALL send conditional request headers (ETag / Last-Modified) using stored checkpoint values.

### Requirement 27: [D8 / SRC-008] Per-Domain Rate Limits (P0)

**User Story:** As a responsible platform, I want per-domain rate limiting, so that connectors do not overload any source.

#### Acceptance Criteria

1. THE System SHALL enforce a configurable per-domain request rate limit across all Connections targeting that domain.
2. IF a request would exceed the per-domain rate limit, THEN THE System SHALL defer the request rather than exceed the limit.
3. IF a source responds with throttling or transient failure, THEN THE System SHALL retry using exponential backoff up to a defined maximum.

### Requirement 28: [D9 / SRC-009] No Platform Passwords / Hard Blockers (P0)

**User Story:** As a user, I want assurance that the platform never asks for third-party passwords, so that my accounts stay secure.

#### Acceptance Criteria

1. THE System SHALL NOT request, accept, or store passwords for third-party employment platforms (for example LinkedIn, SEEK, Indeed).
2. THE System SHALL acquire data only via OAuth, official/public ATS feeds, public career pages, JSON-LD, sitemaps, RSS, user-initiated capture, or manual URL submission.
3. THE System SHALL NOT bypass CAPTCHA, rate limits, anti-bot measures, or authentication of any source (Hard_Blocker).
4. THE System SHALL NOT scrape private, logged-in content (Hard_Blocker).
5. THE System SHALL NOT automatically submit job applications (Hard_Blocker).

### Requirement 29: [D10 / SRC-010] Browser Capture Requires Explicit User Action (P2)

**User Story:** As a user, I want any browser-based capture to happen only when I explicitly act, so that nothing is collected without my initiation.

#### Acceptance Criteria

1. WHERE browser-extension capture is offered, THE System SHALL ingest content only in response to an explicit user action on the current page.
2. THE System SHALL NOT perform background or automated capture of pages the user is viewing.
3. THE System MAY defer full browser-capture implementation to a future spec while preserving these constraints (noted as future).

---

## Capability E: Connector & Crawler Security (SEC-*)

### Requirement 30: [E1 / SEC-001] SSRF Prevention (P0)

**User Story:** As a platform operator, I want connectors blocked from internal addresses, so that the fetcher cannot be abused to reach private infrastructure.

#### Acceptance Criteria

1. IF a fetch target resolves to a private, loopback, link-local, or reserved IP range, THEN THE System SHALL reject the request.
2. IF a fetch target is a cloud metadata endpoint address, THEN THE System SHALL reject the request.
3. WHEN following a redirect, THE System SHALL re-apply SSRF address validation to the redirect target.

### Requirement 31: [E2 / SEC-002] Safe Fetch Controls (P0)

**User Story:** As a platform operator, I want bounded, well-behaved fetches, so that connectors are safe and polite.

#### Acceptance Criteria

1. THE System SHALL send a descriptive user-agent identifying the platform on all connector requests.
2. THE System SHALL respect robots directives where applicable to the source.
3. THE System SHALL limit the number of redirects followed for a single fetch to a defined maximum.
4. IF a response exceeds the configured maximum response size, THEN THE System SHALL abort the fetch.
5. IF a fetch exceeds the configured timeout, THEN THE System SHALL abort the request.
6. IF a response content-type is not in the allowed set for the Connector, THEN THE System SHALL reject the content.
7. THE System SHALL enforce a domain allow/deny policy and SHALL reject fetches to denied domains.

---

## Capability F: Opportunity Processing (OPP-*)

### Requirement 32: [F1 / OPP-001] Store Raw Artifacts Before Parsing (P0)

**User Story:** As a platform operator, I want raw source content stored before parsing, so that extraction is auditable and re-runnable.

#### Acceptance Criteria

1. WHEN a Connector fetches content, THE System SHALL persist the Raw_Artifact before parsing it.
2. THE System SHALL associate each Raw_Artifact with the Connection and Source it came from and the fetch timestamp.
3. THE System SHALL retain Raw_Artifacts according to the configurable raw-source retention policy (PRIV-005).

### Requirement 33: [F2 / OPP-002] Shared Canonical Opportunity Schema (P0)

**User Story:** As a platform developer, I want a single canonical opportunity schema, so that all sources produce comparable records and later specs can extend the model.

#### Acceptance Criteria

1. THE System SHALL map parsed opportunities from every Connector into one shared Canonical_Opportunity schema.
2. THE System SHALL include in the Canonical_Opportunity schema fields for title, company, location, work arrangement, employment type, seniority, salary, posting dates, and source references.
3. THE System SHALL reserve space in the Canonical_Opportunity model for future match/analysis attributes without populating them in this spec.
4. THE System SHALL exclude full opportunity descriptions from collection/list responses (PERF rule) while retaining them for detail retrieval.

### Requirement 34: [F3 / OPP-003] Evidence-Based Extraction (P0)

**User Story:** As a user, I want every extracted fact to carry its evidence, so that I can trust and verify opportunity data.

#### Acceptance Criteria

1. THE System SHALL allow every extracted fact to carry Evidence comprising the source artifact reference, source text, Extraction_Method, and confidence.
2. THE System SHALL set the Extraction_Method to one of STRUCTURED_DATA, RULE, PARSER, LLM, or USER.
3. THE System SHALL NOT invent values for salary, work-rights, requirements, or closing dates that are not present in the source (evidence rule).
4. IF a fact cannot be determined from the source, THEN THE System SHALL mark the fact as uncertain rather than assigning a fabricated value.

### Requirement 35: [F4 / OPP-004] Invalid Records Enter Review Queue (P1)

**User Story:** As an admin, I want invalid parsed records queued for review, so that parsing gaps are visible and correctable.

#### Acceptance Criteria

1. IF a parsed record fails validation against the Canonical_Opportunity schema, THEN THE System SHALL route the record to the Review_Queue.
2. THE System SHALL retain the associated Raw_Artifact for records in the Review_Queue.
3. WHEN a record enters the Review_Queue, THE System SHALL record the validation failure reason.

### Requirement 36: [F5 / OPP-005] Deduplication (P0)

**User Story:** As a user, I want duplicate postings collapsed, so that I see each opportunity once.

#### Acceptance Criteria

1. THE System SHALL deduplicate opportunities using an exact-identity stage, a normalized-fingerprint stage, and a fuzzy-matching stage.
2. WHEN multiple Opportunity_Source records are determined to represent the same opportunity, THE System SHALL associate them with a single Canonical_Opportunity.
3. IF the fuzzy-matching stage cannot determine duplication with sufficient confidence, THEN THE System SHALL route the records for review rather than merging automatically.
4. WHERE both First_Party_Source and aggregator records exist for one opportunity, THE System SHALL select First_Party_Source data as the canonical values per the data-source hierarchy.

### Requirement 37: [F6 / OPP-006] Source Traceability After Merging (P0)

**User Story:** As a user, I want to see all sources behind a merged opportunity, so that provenance is never lost.

#### Acceptance Criteria

1. WHEN Opportunity_Source records are merged into a Canonical_Opportunity, THE System SHALL retain each Opportunity_Source record and its link to the Canonical_Opportunity.
2. THE System SHALL make the list of contributing Opportunity_Source records available on the opportunity detail (source history/traceability).
3. THE System SHALL preserve the Raw_Artifact reference for each contributing Opportunity_Source.

### Requirement 38: [F7 / OPP-007] Closed Opportunities Identified (P1)

**User Story:** As a user, I want closed opportunities identified, so that I do not pursue roles that are no longer available.

#### Acceptance Criteria

1. WHEN a source indicates an opportunity is closed or no longer listed, THE System SHALL set the opportunity's status to Closed or Removed as appropriate.
2. IF closure cannot be determined with confidence, THEN THE System SHALL mark the opportunity as uncertain rather than asserting closure.
3. THE System SHALL retain closed opportunities as accessible records rather than deleting them.

### Requirement 39: [F8 / OPP-008] Content Changes Recorded (P1)

**User Story:** As a user, I want changes to an opportunity recorded, so that I can see how a posting evolved.

#### Acceptance Criteria

1. WHEN a subsequent fetch of an opportunity differs from the stored version, THE System SHALL record that a content change occurred and when.
2. THE System SHALL retain sufficient information to indicate which canonical fields changed.
3. THE System SHALL surface the most recent update time on the opportunity for sorting and display.

---

## Capability G: Opportunity Explorer & Details (Read/Browse Only)

### Requirement 40: [G1] Explorer Views (P0)

**User Story:** As a user, I want card, list, and table views of opportunities, so that I can browse in the layout that suits my task.

#### Acceptance Criteria

1. THE System SHALL present opportunities in card, list, and table view modes.
2. WHEN a user switches view mode, THE System SHALL preserve the current filters, sorting, and result set.
3. THE System SHALL exclude full descriptions from the explorer collection responses (PERF rule) and load them only in the opportunity detail.
4. THE System SHALL paginate or virtualize opportunity collections rather than rendering unbounded lists (PERF rule).

### Requirement 41: [G2] Rich Filters (P0)

**User Story:** As a user, I want to filter opportunities on many dimensions, so that I can narrow to what matters.

#### Acceptance Criteria

1. THE System SHALL provide filters for opportunity type, Role_Profile, company, location, workplace/work arrangement, employment type, seniority, and source.
2. THE System SHALL provide date filters for posted date, first-seen date, and closing date.
3. THE System SHALL provide state filters for saved, dismissed, and needs-review.
4. THE System SHALL provide filters for freshness and for Duplicate_Group.
5. WHEN a user applies or changes a filter, THE System SHALL update the result set to match the active filters.

### Requirement 42: [G3] Sorting (P0)

**User Story:** As a user, I want to sort opportunities, so that I can prioritize by recency or urgency.

#### Acceptance Criteria

1. THE System SHALL provide sorting by newest, newly discovered, closing soon, and recently updated.
2. WHEN a user selects a sort option, THE System SHALL order the result set accordingly.
3. THE System SHALL apply sorting together with the active filters.

### Requirement 43: [G4] Save and Dismiss Actions (P0)

**User Story:** As a user, I want to save or dismiss opportunities, so that I can curate what I track.

#### Acceptance Criteria

1. WHEN a user saves an opportunity, THE System SHALL record the saved state for that user and that opportunity.
2. WHEN a user dismisses an opportunity, THE System SHALL record the dismissed state for that user and that opportunity.
3. WHEN a user reverses a save or dismiss, THE System SHALL clear the corresponding state.
4. THE System SHALL scope saved and dismissed states per user (cross-user isolation).

### Requirement 44: [G5] Shareable URL State (P0)

**User Story:** As a user, I want filters reflected in the URL, so that I can bookmark and share a view.

#### Acceptance Criteria

1. WHEN a user changes filters or sorting, THE System SHALL encode the active filter and sort state in the page URL.
2. WHEN a user opens a URL containing filter and sort state, THE System SHALL restore that filter and sort state.
3. THE System SHALL keep shared URLs free of another user's private state, exposing only filter/sort parameters.

### Requirement 45: [G6] Opportunity Detail With Source History (P0)

**User Story:** As a user, I want an opportunity detail view with source history, so that I can review full information and provenance.

#### Acceptance Criteria

1. WHEN a user opens an opportunity detail, THE System SHALL display the full opportunity information including description and the current Opportunity_Status.
2. THE System SHALL display the contributing Opportunity_Source records and their evidence on the detail view (traceability).
3. THE System SHALL identify First_Party_Source contributors visibly (UX rule).
4. WHEN a user follows a source link, THE System SHALL open the external link safely in a manner that isolates it from the application session (UX safe-link rule).
5. THE System SHALL reserve space in the detail view for future match/analysis content without displaying such content in this spec.

### Requirement 46: [G7] Opportunity Status Language (P0)

**User Story:** As a user, I want consistent status labels, so that I understand each opportunity's state.

#### Acceptance Criteria

1. THE System SHALL display opportunity status using only the labels: New, Active, Closing soon, Closed, Expired, Removed, Needs review, Duplicate, Saved, Applied, Dismissed.
2. WHERE an opportunity's status changes, THE System SHALL display the current label from that fixed set.
3. THE System SHALL display all dates in the user's timezone with the exact date available on demand (UX date rule).

---

## Capability H: Admin Connector-Health View (Basic)

### Requirement 47: [H1] Connector Health and Runs (P0)

**User Story:** As an admin, I want to see connector health and runs, so that I can operate the ingestion pipeline.

#### Acceptance Criteria

1. WHERE the requester holds the Admin role, THE System SHALL display current health status per Connector/Connection.
2. THE System SHALL display recent Connector runs with their status, counts, and failure reasons.
3. IF a non-admin requests the connector-health view, THEN THE System SHALL deny access (AUTH-005).

### Requirement 48: [H2] Parser Failures and Review Queue (P0)

**User Story:** As an admin, I want to see parser failures and the review queue, so that I can address ingestion problems.

#### Acceptance Criteria

1. THE System SHALL display parser/validation failures with their reasons to Admin users.
2. THE System SHALL display the opportunity/duplicate Review_Queue to Admin users.
3. WHEN an Admin accesses parser failures or the Review_Queue, THE System SHALL record an access audit event (AUTH-006).

---

## Capability I: Privacy & Data Control (PRIV-*)

### Requirement 49: [I1 / PRIV-001] Export Data (P0)

**User Story:** As a user, I want to export my data, so that I retain control and portability.

#### Acceptance Criteria

1. WHEN a user requests a data export, THE System SHALL produce an export containing that user's personal data, Role_Profiles, saved/dismissed states, and connected-source configuration.
2. THE System SHALL make the export available to the requesting user only.
3. WHILE an export is being prepared, THE System SHALL show its status to the user (UX long-running-action rule).

### Requirement 50: [I2 / PRIV-002] Delete Data and Account (P0)

**User Story:** As a user, I want to delete my data and account, so that I can remove my presence from the platform.

#### Acceptance Criteria

1. THE System SHALL satisfy account deletion as defined in Requirement B4.
2. WHEN a user requests deletion of specific data without full account deletion, THE System SHALL delete the specified user-owned data after confirmation.

### Requirement 51: [I3 / PRIV-003] Disconnect OAuth Sources (P0)

**User Story:** As a user, I want to disconnect OAuth-connected sources, so that I control third-party access.

#### Acceptance Criteria

1. WHEN a user disconnects an OAuth-connected source, THE System SHALL revoke or discard the stored authorization for that source.
2. WHEN an OAuth source is disconnected, THE System SHALL stop scheduling runs that depend on that authorization.
3. THE System SHALL keep opportunities previously ingested from that source accessible unless the user requests their removal.

### Requirement 52: [I4 / PRIV-004] Minimum OAuth Scopes (P0)

**User Story:** As a privacy-conscious user, I want the platform to request minimal scopes, so that it accesses only what it needs.

#### Acceptance Criteria

1. WHEN initiating any OAuth flow, THE System SHALL request only the minimum scopes required for the intended function.
2. THE System SHALL NOT request scopes for capabilities that are out of scope for this spec.

### Requirement 53: [I5 / PRIV-005] Configurable Raw-Source Retention (P1)

**User Story:** As a platform operator, I want configurable retention of raw source artifacts, so that storage and privacy align with policy.

#### Acceptance Criteria

1. THE System SHALL apply a configurable retention period to Raw_Artifacts.
2. WHEN a Raw_Artifact exceeds the configured retention period, THE System SHALL delete or anonymize it.
3. THE System SHALL keep Canonical_Opportunities accessible after their underlying Raw_Artifacts are removed by retention.

### Requirement 54: [I6 / PRIV-006] Per-Resource Ownership Checks (P0)

**User Story:** As a user, I want strict isolation of my data, so that no other user can access it.

#### Acceptance Criteria

1. WHEN a user requests a user-owned resource, THE System SHALL verify the requester owns that resource before returning it.
2. IF a requester does not own the requested user-scoped resource, THEN THE System SHALL deny access.
3. THE System SHALL apply ownership checks to Role_Profiles, saved/dismissed states, connections, exports, and sessions.

---

## Capability J: Reliability & Graceful Degradation (RES-*)

### Requirement 55: [J1 / RES-001] Connector Failure Isolation (P0)

**User Story:** As a user, I want the app to keep working when a connector fails, so that ingestion problems do not break browsing.

#### Acceptance Criteria

1. IF a Connector fails, THEN THE System SHALL keep the opportunity dashboard and explorer available.
2. IF one Connector fails, THEN THE System SHALL continue running the other Connectors.
3. WHILE a Connector is failing, THE System SHALL keep previously ingested opportunities accessible.

### Requirement 56: [J2 / RES-002] Long-Running Action Status (P0)

**User Story:** As a user, I want visible status for long-running actions, so that I know work is progressing.

#### Acceptance Criteria

1. WHILE a long-running action (export, connector run, manual URL processing) is in progress, THE System SHALL display its status to the initiating user.
2. WHEN a long-running action completes or fails, THE System SHALL update its displayed status accordingly.

---

## Capability K: Accessibility (A11Y-*)

### Requirement 57: [K1 / A11Y-001] WCAG 2.2 AA Target (P0)

**User Story:** As a user relying on assistive technology, I want the app to meet WCAG 2.2 AA, so that I can use it effectively.

#### Acceptance Criteria

1. THE System SHALL target conformance with WCAG 2.2 Level AA across public and authenticated interfaces.
2. THE System SHALL provide keyboard navigation for all interactive controls, including the command palette and navigation.
3. WHERE the user has requested reduced motion, THE System SHALL minimize non-essential animation.
4. THE System SHALL implement dialogs and charts with accessible roles, labels, and focus management.

---

## Capability L: Performance (PERF-*)

### Requirement 58: [L1 / PERF-001] Explorer Query and Search Latency (P0)

**User Story:** As a user, I want fast browsing and search, so that exploration feels responsive.

#### Acceptance Criteria

1. WHEN a common opportunity list query is executed, THE System SHALL return results with a p95 latency below 500 milliseconds where practical.
2. WHEN a search query is executed, THE System SHALL return results with a p95 latency below 800 milliseconds where practical.
3. THE System SHALL paginate or virtualize collection responses and SHALL exclude full descriptions from those responses.

---

## Traceability Notes

- PRD IDs are preserved inline (AUTH-_, PROF-_, SRC-_, OPP-_, PRIV-_, RES-_, SEC-_, A11Y-_, PERF-_). SEC-_, RES-_, UX-_, A11Y-_, and PERF-_ IDs are introduced here to encode the non-negotiable cross-cutting rules as verifiable requirements.
- Hard_Blocker constraints are consolidated in D9 (SRC-009) and referenced from connector security (Capability E).
- Match scoring and AI analysis remain out of scope; F2 and G6 reserve model/UI space without implementing them.
