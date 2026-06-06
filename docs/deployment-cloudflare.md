# Cloudflare Deployment

TripMate v1.0 production API is `services/api-worker`. The reference `services/api` Express server remains available for comparison and migration only.

## Target Stack

- Cloudflare Workers for API runtime
- Hono for routing
- D1 for relational data
- KV for provider search cache
- R2 for share thumbnails and future PDF/image exports
- Cloudflare Pages or another static host for landing/admin surfaces

## Local Worker

```sh
npm run worker:dev
npm run worker:typecheck
```

Apply local D1 migrations before endpoint smoke tests:

```sh
cd services/api-worker
npx wrangler d1 execute tripmate-local --local --file=./migrations/0001_initial.sql
npx wrangler d1 execute tripmate-local --local --file=./migrations/0002_trip_exports.sql
npx wrangler d1 execute tripmate-local --local --file=./migrations/0003_operational_events.sql
```

## Preview Deploy

```sh
npm run worker:deploy:preview
```

Before preview deploy:

- Create preview D1, KV, and R2 resources.
- Replace placeholder IDs in `services/api-worker/wrangler.toml`.
- Set all Cloudflare secrets with `wrangler secret put`.
- Run `npm run check:health`.
- Run `npm test`.

## Production Deploy

Production deploy must use Cloudflare Workers Paid for monetized service operation. Do not deploy the monetized API to a free personal-only hosting plan.

Production gates:

- `npm run check:health`
- `npm test`
- local or preview Worker smoke for `/health`
- D1 migration reviewed
- provider keys set as Cloudflare secrets
- `OPS_ADMIN_TOKEN` set as a Cloudflare secret for `/api/v1/ops/*`
- no provider secrets in mobile env or bundle
- gitleaks pre-push passes

## Required Endpoints

The Worker exposes the v1 release contract under `/api/v1`, including health, places, planner, routes, trips, share links, and monetization endpoints. Placeholder trip-day and trip-place mutation endpoints must be completed before app-store release if the mobile edit UI depends on remote persistence.

## Operational Events

The Worker persists privacy-safe operational events in D1 for place search, provider adapter search, planner generation, and route optimization. These records store endpoint/provider target, status, duration, request id where available, counts, mode/style/cache status, and warning count. They must not store raw request bodies, provider payloads, tokens, receipts, or precise coordinates.

Admin summary:

```sh
curl -H "Authorization: Bearer $OPS_ADMIN_TOKEN" \
  "https://<worker-host>/api/v1/ops/summary?hours=24"
```

The summary endpoint returns grouped operational events, ad events, affiliate clicks, and entitlement counts. It requires `OPS_ADMIN_TOKEN` and must not be called from mobile clients.
