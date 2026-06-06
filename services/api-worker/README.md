# TripMate API Worker

Cloudflare Workers + Hono + D1 production API boundary for TripMate v1.0.

The current production-reference implementation remains in `services/api` until the Worker service has equivalent health, places, planner, routes, trips, sharing, and monetization endpoints.

## Commands

```sh
npm --prefix services/api-worker run dev
npm --prefix services/api-worker run typecheck
npm --prefix services/api-worker run deploy:preview
```

## Implemented

- `GET /health`
- `GET /api/v1/health`
- request id middleware
- explicit CORS policy
- shared error response schema
- Kakao auth/session endpoints
- authenticated trip, trip-day, and trip-place CRUD
- authenticated bulk trip-place reorder for schedule regeneration sync
- authenticated trip-place sync for creating/relinking/reordering replanned places
- read-only share link API and public share page
- place provider adapters and normalized place search
- planner and route optimization endpoints
- monetization entitlement, ad event, and affiliate click endpoints
- premium-gated trip export preparation endpoint
- owned export download endpoint backed by R2 assets
- authenticated print-ready HTML export assets with private cache headers
- scheduled and manual operations retention cleanup
- D1, KV, and R2 binding types
- D1 schema and migrations

## Not Yet Implemented

- binary PDF/image rendering workers
- public/shared export links for generated export assets
- live provider smoke test with production Cloudflare secrets
- mobile IAP receipt submission UI

See `docs/tripmate-v1-development-plan.md` for the release plan and phase order.
