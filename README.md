# CareerStack (CareerRadar AI)

A personal career-opportunity intelligence platform that discovers, normalizes, deduplicates, and ranks employment opportunities from permitted, first-party sources — jobs, graduate programs, internships, events, and networking opportunities — in one place.

**Tagline:** Find the right opportunity before everyone else.

> This repository is built incrementally in vertical slices. The first slice, `foundation-discovery-core`, delivers the application foundation, passwordless auth, role profiles, source connectors, the opportunity ingestion pipeline, and a read-only opportunity explorer.

## Architecture

Modular monolith with asynchronous workers, delivered as a pnpm + Turborepo TypeScript monorepo.

```
apps/
  web/      # Next.js App Router (RSC + client islands), shadcn/ui, Tailwind
  api/      # NestJS + Fastify HTTP API (/api/v1)
  worker/   # BullMQ consumers (ingestion pipeline, retention, expiry)
packages/
  ui/            # shared design system on shadcn/ui
  database/      # Drizzle schema, migrations, repositories
  contracts/     # shared Zod schemas + OpenAPI types
  auth/          # session, OAuth/PKCE, magic-link, CSRF, guards
  config/         # typed config loader (brandName, retention, limits)
  observability/ # logging, tracing, metrics, correlation
  connectors/    # OpportunityConnector interface + Greenhouse/Lever/Ashby/JSON-LD
  security/      # SafeFetcher, SSRF guard, sanitizer, canonical URL
  testing/       # fixtures, fast-check arbitraries, harness
  shared/        # pure domain logic: normalization, dedup, canonicalization
infra/           # docker-compose (postgres+pgvector, redis, minio)
```

## Specifications

The product is specified under `.kiro/specs/`. See `foundation-discovery-core/` for requirements, design, and the implementation plan.

## Status

🚧 Under active development.
