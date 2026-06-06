# TripMate API Worker

Cloudflare Workers + Hono + D1 production API boundary for TripMate v1.0.

The current production-reference implementation remains in `services/api` until the Worker service has equivalent health, places, planner, routes, trips, sharing, and monetization endpoints.

## Commands

```sh
npm --prefix services/api-worker run dev
npm --prefix services/api-worker run typecheck
npm --prefix services/api-worker run deploy:preview
```

## Implemented In Phase 4

- `GET /health`
- `GET /api/v1/health`
- request id middleware
- explicit CORS policy
- shared error response schema
- auth middleware skeleton
- required v1 route skeletons returning `501 NOT_IMPLEMENTED`
- D1, KV, and R2 binding types

## Not Yet Implemented

- D1 schema and queries
- trip ownership checks
- provider adapters
- provider cache
- monetization persistence

See `docs/tripmate-v1-development-plan.md` for the release plan and phase order.
