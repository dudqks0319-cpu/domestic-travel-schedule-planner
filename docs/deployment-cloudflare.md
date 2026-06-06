# Cloudflare Deployment

TripMate v1.0 production API is `services/api-worker`. The reference `services/api` Express server remains available for comparison and migration only.

## Target Stack

- Cloudflare Workers for API runtime
- Hono for routing
- D1 for relational data
- KV for provider search cache
- R2 for share/export assets
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
npx wrangler d1 execute tripmate-local --local --file=./migrations/0004_user_profile_image.sql
```

## Preview Deploy

```sh
npm run worker:deploy:preview
```

Before preview deploy:

- Create preview D1, KV, and R2 resources.
- Replace placeholder IDs in `services/api-worker/wrangler.toml`.
- Set all Cloudflare secrets with `wrangler secret put`.
- Confirm the `TripMate v1 Gate` GitHub Actions workflow is passing on the branch.
- Run `npm run check:env:preview`.
- Run `npm run check:release-contract`.
- Run `npm run check:health`.
- Run `npm test`.

## Production Deploy

Production deploy must use Cloudflare Workers Paid for monetized service operation. Do not deploy the monetized API to a free personal-only hosting plan.

Production gates:

- `TripMate v1 Gate` GitHub Actions workflow passing on the release commit
- `npm run check:health`
- `npm run check:env:production`
- `npm run check:release-contract`
- `npm test`
- local or preview Worker smoke for `/health`
- D1 migration reviewed
- provider keys set as Cloudflare secrets
- `OPS_ADMIN_TOKEN` set as a Cloudflare secret for `/api/v1/ops/*`
- no provider secrets in mobile env or bundle
- gitleaks pre-push passes

## Required Endpoints

The Worker exposes the v1 release contract under `/api/v1`, including health, auth, places, planner, routes, trips, trip-day mutations, trip-place mutations, share links, export preparation/downloads, monetization, and operations endpoints. Trip-day and trip-place editing routes are part of the release contract and are checked by `npm run check:release-contract`.

## Operational Events

The Worker persists privacy-safe operational events in D1 for place search, provider adapter search, planner generation, and route optimization. These records store endpoint/provider target, status, duration, request id where available, counts, mode/style/cache status, and warning count. They must not store raw request bodies, provider payloads, tokens, receipts, or precise coordinates.

Admin summary:

```sh
curl -H "Authorization: Bearer $OPS_ADMIN_TOKEN" \
  "https://<worker-host>/api/v1/ops/summary?hours=24"
```

The summary endpoint returns grouped operational events, ad events, affiliate clicks, and entitlement counts. It requires `OPS_ADMIN_TOKEN`, must not be called from mobile clients, and records an `ops.summary.read` audit event without storing the token. Rotate `OPS_ADMIN_TOKEN` per environment when operator access changes, after an incident, before production handoff, and on the regular operations rotation schedule.

Retention dry run:

```sh
curl -X POST -H "Authorization: Bearer $OPS_ADMIN_TOKEN" \
  "https://<worker-host>/api/v1/ops/retention?dryRun=true&auditDays=365&operationalDays=90"
```

Retention execution:

```sh
curl -X POST -H "Authorization: Bearer $OPS_ADMIN_TOKEN" \
  "https://<worker-host>/api/v1/ops/retention?auditDays=365&operationalDays=90"
```

The retention endpoint deletes `audit_logs` older than `auditDays`, deletes `operational_events` older than `operationalDays`, deletes expired trip export manifest/asset objects from R2, and marks expired export records in D1. Use dry run before production execution, keep audit retention at 365 days or longer unless legal policy changes, and run it only from trusted operations automation. The endpoint records an `ops.retention.run` audit event with counts and never stores the operations token.

Scheduled retention:

- Preview cron: `37 18 * * *` UTC, daily.
- Production cron: `17 18 * * *` UTC, daily.
- The scheduled handler runs the same 365-day audit, 90-day operational event, and expired export cleanup policy, records `ops.retention.scheduled`, and writes a privacy-safe operational event.
- Cloudflare cron triggers execute on UTC time and may take several minutes to propagate after deployment.

Local scheduled test with Wrangler:

```sh
npm run worker:dev
curl "http://localhost:8787/cdn-cgi/handler/scheduled?format=json"
```

Worker v1 smoke:

```sh
npm run worker:smoke -- --base-url http://127.0.0.1:8787
npm run worker:smoke -- --base-url https://<preview-worker> --ops-token "$OPS_ADMIN_TOKEN"
```

The smoke script checks health, planner generate/replan, route optimization, provider search contract, Kakao dev login, authenticated trip/day/place/share CRUD, free saved-trip limit denial, monetization event logging, entitlement state, optional ops summary, optional ops retention dry run, cleanup, and logout. It creates and deletes smoke-owned data. Before any write step, it reads `/health` and refuses to continue unless `ENVIRONMENT` is `local` or `preview`. Do not run this write smoke against production.

Preview smoke can also be triggered manually from GitHub Actions with `TripMate Worker Preview Smoke`. Provide the preview Worker base URL as `base_url`; the workflow uses `OPS_ADMIN_TOKEN` from repository secrets when available and still relies on the smoke script's `/health` environment guard before write requests.
