# TripMate API Worker

Cloudflare Workers + Hono + D1 production API boundary for TripMate v1.0.

The current production-reference implementation remains in `services/api` until the Worker service has equivalent health, places, planner, routes, trips, sharing, and monetization endpoints.

## Commands

```sh
npm --prefix services/api-worker run dev
npm --prefix services/api-worker run typecheck
npm --prefix services/api-worker run deploy:preview
npm run worker:smoke:local
npm run release:preview:gate -- --base-url https://<preview-worker>
npm run worker:smoke -- --base-url http://127.0.0.1:8787
npm run worker:smoke:naver -- --base-url https://<preview-worker> --ops-token "$OPS_ADMIN_TOKEN"
```

`worker:smoke:local` is the preferred local runtime gate. It applies local D1 migrations, starts `wrangler dev --local`, runs the full v1 write smoke, and stops the Worker process.

`release:preview:gate` is the preferred preview handoff gate. It runs preview env readiness, Cloudflare secret-name checks, release contract checks, planner tests, build/typecheck health checks, and strict provider smoke against the deployed preview Worker.

`worker:smoke:naver` is the strict preview provider smoke. It requires live Naver Search and Naver Cloud Maps geocode, reverse-geocode, planner route enrichment, and route optimization responses. It still refuses write smoke outside `ENVIRONMENT=local` or `preview`.

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
- read-only shared export download endpoint backed by active share tokens
- shared export metadata in the public share API and export links in the read-only share page
- authenticated multi-page binary PDF export assets with private cache headers
- authenticated SVG image export assets with private cache headers
- scheduled and manual operations retention cleanup
- D1, KV, and R2 binding types
- D1 schema and migrations

## Not Yet Implemented

- live strict provider smoke evidence from a configured preview Worker
- live mobile IAP SDK purchase/receipt capture and store validation

See `docs/tripmate-v1-development-plan.md` for the release plan and phase order.
