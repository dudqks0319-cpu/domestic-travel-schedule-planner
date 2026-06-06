# TripMate

Domestic-travel schedule planner for Korea. The MVP direction is a map-first workflow: choose a region, choose dates, choose a travel style, then generate a date-by-date itinerary and route view.

## Workspace

```text
apps/mobile       Expo Router mobile app
packages/planner Shared route/planning primitives
services/api      Current Express + Prisma + SQLite API
services/api-worker Planned Cloudflare Workers + D1 API
```

## Local Commands

```sh
npm test
npm run mobile:typecheck
npm run api:build
npm run planner:build
npm run check:env
```

`npm test` currently runs the planner package tests. Use `npm run check:health` for the broader type/build gate.

## Environment

Copy `services/api/.env.example` to `services/api/.env` and set real values outside source control.

Required local API keys:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `DATA_GO_KR_API_KEY`

Provider keys stay server-side:

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `ODSAY_API_KEY`

The mobile app reads `EXPO_PUBLIC_API_BASE_URL` from `apps/mobile/.env` when present. Do not put provider secrets in the mobile bundle.

## Deployment Direction

The current API is Node/Express/Prisma and is not directly deployable to Cloudflare Workers. The target monetized MVP path is Cloudflare Workers Paid + D1 + KV + R2 through a new additive `services/api-worker` service.

See `docs/cloudflare-workers-mvp-plan.md`.

## Monetization Policy

- Digital premium features should use Apple/Google IAP.
- External bookings such as lodging, tickets, rental cars, and insurance should use affiliate links or a separate physical-service payment flow.
- Sponsored places must be clearly marked as ads or sponsored content.

## Production Safety

Production must not display synthetic coordinates as real places or real routes. If provider data is unavailable, the UI should show an empty or unavailable state instead of fake route points.
