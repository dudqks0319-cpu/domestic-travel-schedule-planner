# TripMate

Domestic-travel schedule planner for Korea. TripMate v1.0 is a map-first product: choose a Korean travel region, choose dates, choose a travel style, then generate a date-by-date itinerary, route summary, and shareable trip plan from server-side provider data.

## Workspace

```text
apps/mobile       Expo Router mobile app
packages/planner Shared route/planning primitives
services/api      Reference Express + Prisma + SQLite API
services/api-worker Production Cloudflare Workers + Hono + D1 API
```

## Local Commands

```sh
npm test
npm run mobile:typecheck
npm run api:build
npm run planner:build
npm run worker:typecheck
npm run worker:smoke:local
npm run check:release-contract
npm run check:health
npm run check:env
```

`npm test` runs planner tests. `npm run check:release-contract` verifies root scripts, required release docs, Worker route contracts, D1 schema tables, mobile secret boundaries, and the GitHub Actions release gate. `npm run check:health` runs mobile typecheck, Express API build, planner build, and Worker typecheck. `npm run check:dev` runs the env check, release contract check, and health check; local missing env files are warnings, while `check:env:preview` and `check:env:production` enforce Cloudflare deploy readiness.

`npm run worker:smoke:local` applies local D1 migrations, starts the local Worker, runs the full write smoke against `http://127.0.0.1:8787`, and stops the Worker process. It is the preferred local runtime gate before preview smoke.

GitHub Actions runs `.github/workflows/tripmate-v1-gate.yml` on pull requests and protected release branches. The workflow installs dependencies with `npm ci`, then runs the release contract check, planner tests, health gate, and Worker smoke script syntax check.

For preview environments, run `.github/workflows/tripmate-worker-preview-smoke.yml` manually with the preview Worker base URL. It runs the write smoke script only after the Worker reports `ENVIRONMENT=local` or `ENVIRONMENT=preview`.

## Environment

Copy `services/api/.env.example` to `services/api/.env` only for the reference Express API. For the production Worker API, use Cloudflare secrets and bindings.

Mobile public variables:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_MAP_PROVIDER`

`EXPO_PUBLIC_API_BASE_URL` may be the Worker origin or a Worker `/api/v1` URL. The mobile app normalizes it to the v1 API and defaults to `http://localhost:8787/api/v1` for local Worker development.

Reference Express API variables:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `DATA_GO_KR_API_KEY`

Provider keys stay server-side:

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `ODSAY_API_KEY`

Never put provider secrets, JWT secrets, Apple shared secrets, or Google Play service-account JSON in the mobile bundle.

## Production API

The production API lives in `services/api-worker`:

- Cloudflare Workers + Hono
- Cloudflare D1 for users, trips, shares, entitlements, ads, affiliates, sponsored places, and audit logs
- Cloudflare KV for provider search cache
- Cloudflare R2 binding for share thumbnails and future export files

See:

- `docs/deployment-cloudflare.md`
- `docs/env.md`
- `docs/provider-policy.md`
- `docs/monetization-policy.md`
- `docs/privacy-security-checklist.md`

## Monetization Policy

- Digital premium features should use Apple/Google IAP.
- External bookings such as lodging, tickets, rental cars, and insurance should use affiliate links or a separate physical-service payment flow.
- Sponsored places must be clearly marked as ads or sponsored content.
- Ad events are allowed after itinerary generation, share completion, or free export actions, not during itinerary generation.

## Production Safety

Production must not display synthetic coordinates as real places or real routes. If provider data is unavailable, the UI should show an empty or unavailable state instead of fake route points.
