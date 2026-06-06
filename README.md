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
npm run check:health
npm run check:env
```

`npm test` runs planner tests. `npm run check:health` runs mobile typecheck, Express API build, planner build, and Worker typecheck. `npm run check:dev` also runs `scripts/dev-readiness-check.mjs`, which currently expects a local `services/api/.env` for the reference API.

## Environment

Copy `services/api/.env.example` to `services/api/.env` only for the reference Express API. For the production Worker API, use Cloudflare secrets and bindings.

Mobile public variables:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_MAP_PROVIDER`

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
