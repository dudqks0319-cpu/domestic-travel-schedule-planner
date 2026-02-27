# TripMate v3.0 Architecture Overview

## 1) Purpose

TripMate v3.0 should support reliable trip planning, itinerary editing, and external data enrichment (places, weather, pricing) while keeping UI iteration fast and API contracts stable.

## 2) Scope

This architecture covers:

1. App boundary and module ownership
2. Runtime data flow between mobile app, API, and external providers
3. Reliability, security, and observability requirements
4. Acceptance criteria for architecture readiness

## 3) Monorepo Boundaries

1. `apps/mobile`
   - End-user client UI and interaction flows
   - State management, API client usage, offline cache UX
2. `packages/planner`
   - Shared domain models and business rules for trip planning
   - Validation utilities, date/time normalization, planning primitives
3. `services/api`
   - API gateway/BFF plus domain orchestration
   - Auth integration, persistence, provider adapter calls, audit logging

## 4) Target Runtime Topology

```text
Mobile App (apps/mobile)
  -> TripMate API (services/api)
      -> Core DB (trip/user/itinerary state)
      -> Cache + Job Queue (rate-limited or slow workflows)
      -> External Provider Adapters (maps, weather, booking/price, content)
  <- Typed API Responses + Error Schema

Shared domain package (packages/planner) is imported by mobile + API.
```

## 5) Key Architectural Principles

1. API-first contracts
   - OpenAPI-driven contract is versioned before feature coding.
2. Adapter isolation for external integrations
   - Provider-specific logic never leaks into core domain objects.
3. Shared domain invariants
   - Trip/date/location validation logic is centralized in `packages/planner`.
4. Observable-by-default operations
   - Every API request has correlation IDs, structured logs, and latency/error metrics.
5. Graceful degradation
   - If provider APIs fail, app still loads cached/local trip data with explicit fallback UX.

## 6) Core Data Flow (Trip Planning Request)

1. Mobile sends authenticated request to `/v3/trips/:id/plan`.
2. API validates payload using shared planner schema.
3. API loads trip state from DB and enriches with provider data via adapters.
4. Planner rules compute itinerary suggestions and conflict checks.
5. API persists finalized plan and returns typed response plus warnings.
6. Mobile updates optimistic UI state and reconciles with server version.

## 7) Reliability + Security Baseline

1. Reliability
   - Non-provider-backed endpoints target p95 latency under 400ms.
   - Provider-backed endpoints target p95 latency under 1200ms with fallback behavior.
   - External adapter retries are bounded and idempotent-safe.
2. Security
   - JWT/OAuth access token verification at API edge.
   - Row-level ownership checks for trip and collaborator resources.
   - Secrets handled only through environment or secret manager, never in client code.
3. Data quality
   - All date/time values are timezone-aware.
   - API returns deterministic error codes and user-safe messages.

## 8) Deployment + Environment Model

1. Environments: `dev`, `staging`, `prod`
2. Contract promotion path:
   - Contract update -> mock validation -> staging integration -> production rollout
3. Release policy:
   - Backward-compatible changes can deploy continuously.
   - Breaking API changes require `/v3` minor/major version decision and migration notes.

## 9) Architecture Acceptance Criteria

1. Domain boundaries are documented and accepted by mobile + API owners.
2. At least one end-to-end flow (trip create -> plan -> save -> reload) is documented with request/response examples.
3. OpenAPI contract includes standardized error schema and correlation ID behavior.
4. External provider adapter interface is defined with retry, timeout, and fallback rules.
5. Observability dashboard requirements are written (latency, error rate, provider failure rate).
6. Security checks include auth validation and resource ownership enforcement for all write endpoints.
