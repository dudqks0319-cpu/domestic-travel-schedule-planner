# TripMate v1.0 LazyCodex Release Plan

Created: 2026-06-17
Repo: `dudqks0319-cpu/domestic-travel-schedule-planner`
Working branch: `agent/tripmate-v1-release-goal`
Working tree: `/Users/jyb-m3max/Desktop/codex/tripmate-v1-release-goal`
Base commit: `1e84af1` (`Polish tab UI and align trip schedule/route-map visuals`)

## 1. Objective

Build TripMate into a release-ready v1.0 domestic travel planner, not a reduced MVP.

Product sentence:

> A Korea domestic trip planner where users pick regions and places from a national map, then TripMate generates date-based itineraries and optimized routes from normalized Naver, Kakao, and Tour API data.

Execution rule:

1. Keep the final product scope complete.
2. Implement in phases.
3. Finish each phase with code, verification, risk notes, and a meaningful commit.
4. Do not claim completion without tests or a clear reason a test cannot run.

## 2. Phase 0 Baseline

Current confirmed structure:

1. `apps/mobile`: Expo Router / React Native mobile app.
2. `packages/planner`: shared planning logic package.
3. `services/api`: existing Express API reference implementation.
4. `services/api-worker`: not present on the base branch yet; this must be created for Cloudflare Worker production API.
5. `docs`: existing target-state docs are named v3.0. This v1.0 plan is the execution contract for the current release goal and should not be merged conceptually with the older v3.0 labels.

Important baseline decisions:

1. Use `services/api` as a reference and compatibility surface while building `services/api-worker`.
2. Treat `services/api-worker` as the production target for v1.0.
3. Keep provider secrets server-side only.
4. Use provider adapters so Naver, Kakao, Tour API, and fallback cache behavior can be changed without leaking provider details into mobile UI.
5. Do not let synthetic coordinates or placeholder routes appear as real production recommendations.

## 3. Product Scope

TripMate v1.0 must include:

1. Kakao login, guest mode, logout, secure token storage, and account/data deletion path.
2. Map-first home screen with national travel regions and quick-start style chips.
3. 3-4 step trip creation based on region, dates, and style, with optional transport, companions, accommodation, and preference filters.
4. Server-normalized place search and recommendations from Naver, Kakao, Tour API, and internal cache.
5. Date-based itinerary generation with `Trip`, `TripDay`, `TripPlace`, route summary, provider warnings, and regeneration hints.
6. Schedule screen with date tabs, timeline, place cards, edit/move/delete/reorder actions, and no raw lat/lng display.
7. Map screen with real provider abstraction, markers, route polyline, day filter, and map/list switching.
8. Unified search with merged provider results, deduplication, filters, and add-to-itinerary flow.
9. Trip save/list/detail/edit/delete and read-only share links.
10. Monetization scaffolding for ads, premium entitlement, affiliate clicks, and sponsored places.
11. Cloudflare Workers native fetch router + D1 + KV/Cache + R2 deployment path.
12. Documentation for environment variables, providers, monetization, privacy/security, deployment, and local operation.

## 4. Non-Negotiable Constraints

1. Do not reduce this to an MVP.
2. Do not add provider secrets to the mobile bundle.
3. Do not expose `NAVER_CLIENT_SECRET`, `KAKAO_REST_API_KEY`, `DATA_GO_KR_API_KEY`, JWT secrets, Apple shared secret, or Google service account JSON to Expo public env.
4. Do not show production synthetic coordinates as real places.
5. Do not silently ignore map, route, or provider failures.
6. Do not show raw latitude/longitude to normal users in itinerary UI.
7. Do not hide sponsored content inside organic recommendations.
8. Do not put all phases into one large commit.
9. Do not mark work complete without verification evidence.

## 5. UI/UX Contract

Use the existing TripMate design-system direction:

1. Font: `Noto Sans KR`.
2. Primary: `#0EA5E9`.
3. Secondary: `#38BDF8`.
4. CTA: `#F97316`.
5. Background: `#F0F9FF`.
6. Text: `#0C4A6E`.

Experience rules:

1. First screen is map-first, not search-box-first.
2. Users should be able to generate a draft with only region, dates, and style.
3. Every async screen must have loading, empty, error, and recovery states.
4. Quick-start styles pass stable `styleKey` values, not display titles.
5. Touch targets must be at least 44 dp where possible; add `hitSlop` for small icon controls.
6. The itinerary and map must stay connected: selecting a place in one view should make the other view understandable.
7. Ads must not interrupt itinerary generation.
8. Sponsored places must show a visible "Ad" or "Sponsored" label in all surfaces.
9. Reduced-motion and accessibility behavior must remain acceptable for map/list transitions and bottom sheets.

## 6. Provider and Domain Contracts

Provider adapter shape:

```ts
export interface PlaceProviderAdapter {
  searchPlaces(input: {
    query: string;
    lat?: number;
    lng?: number;
    radius?: number;
    category?: string;
    limit?: number;
  }): Promise<NormalizedPlace[]>;
  geocode(input: { address: string }): Promise<{ lat: number; lng: number } | null>;
  reverseGeocode(input: { lat: number; lng: number }): Promise<{ address: string } | null>;
  getDirections(input: {
    points: Array<{ lat: number; lng: number; name?: string }>;
    mode: "driving" | "transit" | "walking";
  }): Promise<NormalizedRoute | null>;
}
```

Normalized place:

```ts
export interface NormalizedPlace {
  id: string;
  provider: "naver" | "kakao" | "tour" | "manual";
  providerPlaceId?: string;
  name: string;
  category: string;
  address?: string;
  roadAddress?: string;
  lat: number;
  lng: number;
  phone?: string;
  imageUrl?: string;
  sourceUrl?: string;
  description?: string;
  tags: string[];
  score: number;
  isSponsored: boolean;
  sponsorLabel?: string;
}
```

Provider priority:

1. Naver place / local search.
2. Kakao place / coordinate search.
3. Tour API attractions, festivals, and events.
4. Internal cache.
5. Explicit empty state with provider warning.

Fallback behavior:

1. Provider timeouts must be bounded.
2. Cache should be used before repeated provider calls.
3. Provider failures must return warnings to the mobile app.
4. Fake place data is allowed only in development fixtures and must be impossible to present as production provider data.

## 7. Worker API Target

Production API target:

1. `services/api-worker`.
2. Cloudflare Workers native `fetch` router with explicit route definitions.
3. D1 for relational data.
4. KV or Cache API for provider lookup cache.
5. R2 for share thumbnails or export files.
6. `wrangler` for preview/prod deployment.

Required endpoints:

1. `GET /health`
2. `GET /api/v1/health`
3. `GET /api/v1/places/search`
4. `GET /api/v1/places/:placeId`
5. `POST /api/v1/planner/generate`
6. `POST /api/v1/planner/replan`
7. `POST /api/v1/routes/optimize`
8. `GET /api/v1/trips`
9. `POST /api/v1/trips`
10. `GET /api/v1/trips/:tripId`
11. `PATCH /api/v1/trips/:tripId`
12. `DELETE /api/v1/trips/:tripId`
13. `POST /api/v1/trips/:tripId/days`
14. `PATCH /api/v1/trips/:tripId/days/:dayId`
15. `POST /api/v1/trips/:tripId/places`
16. `PATCH /api/v1/trips/:tripId/places/:placeId`
17. `DELETE /api/v1/trips/:tripId/places/:placeId`
18. `POST /api/v1/trips/:tripId/share`
19. `GET /api/v1/share/:shareId`
20. `POST /api/v1/monetization/ad-events`
21. `POST /api/v1/monetization/affiliate-clicks`
22. `POST /api/v1/monetization/entitlements/verify`
23. `GET /api/v1/monetization/entitlements/me`

## 8. D1 Schema Scope

Create migrations for:

1. `users`
2. `user_sessions`
3. `trips`
4. `trip_days`
5. `trip_places`
6. `provider_places`
7. `route_cache`
8. `place_cache`
9. `share_links`
10. `subscription_entitlements`
11. `ad_events`
12. `affiliate_clicks`
13. `sponsored_places`
14. `audit_logs`

Every table must consider:

1. `id`
2. `created_at`
3. `updated_at`
4. `deleted_at` or `status`
5. user ownership
6. provider source
7. cache expiry where relevant
8. privacy-safe audit logging

## 9. Security Gate

Each phase must evaluate:

1. Secrets are not hardcoded and logs do not leak sensitive values.
2. AuthN/AuthZ checks are explicit; deny by default for write APIs.
3. Untrusted input is validated and user-visible output is safe.
4. Dependencies are pinned and critical CVEs are handled or documented.
5. Sensitive data is minimized and redacted in logs.
6. Abuse controls are considered for provider, route, share, and monetization endpoints.
7. Negative-path tests exist for auth and validation failures once the related code exists.
8. Residual risks have an owner and due date.

## 10. Phase Plan

### Phase 0. Repository Analysis and Plan Lock

Deliverables:

1. Confirm branch, baseline commit, and worktree.
2. Document current architecture and v1.0 execution plan.
3. Identify dangerous change surfaces.

Verification:

1. `git status --short --branch`
2. `git diff --check`
3. Secret scan on new docs.

Commit:

1. `docs: add TripMate v1 release plan`

### Phase 1. Shared Types and Domain Baseline

Deliverables:

1. Add `apps/mobile/constants/travelStyles.ts`.
2. Add shared planner types for `NormalizedPlace`, `NormalizedRoute`, `TripPlanInput`, and `TripPlanResult`.
3. Route home style selection into `trip/create` by `styleKey`.
4. Remove title-string logic for style decisions.
5. Normalize current trip storage shape.

Verification:

1. `npm run mobile:typecheck`
2. `npm run planner:build`
3. Unit tests for style key mapping and planner type contracts.

Commit:

1. `feat: add TripMate v1 domain style contracts`

### Phase 2. Mobile v1.0 UX

Deliverables:

1. Improve map-first home.
2. Add map provider abstraction and separate mock map from production provider.
3. Convert trip creation into a low-friction 3-4 step flow.
4. Improve search, schedule, and map screens.
5. Add loading, empty, error, offline, and retry states.
6. Remove raw lat/lng from itinerary UI.
7. Add production guard against synthetic coordinates.

Verification:

1. `npm run mobile:typecheck`
2. Manual web or simulator smoke flow for region -> dates -> style -> draft.
3. UI check for loading, empty, error, and provider-failure states.

Commit:

1. `feat: complete map-first mobile planning flow`

### Phase 3. Planner Engine

Deliverables:

1. Date count calculation.
2. Day-by-day place distribution.
3. Meal, cafe, rest, accommodation, and travel-time placement.
4. Style-specific density rules.
5. Distance clustering and ordering.
6. Regeneration hints and provider warnings.

Verification:

1. Planner tests for 1-day, 2-day, 3-day, and 5-day trips.
2. Tests proving style differences.
3. Tests proving distant places are not over-packed into one day.
4. `npm run planner:build`

Commit:

1. `feat: implement date-based trip planner engine`

### Phase 4. Cloudflare Worker API Foundation

Deliverables:

1. Create `services/api-worker`.
2. Add TypeScript, Wrangler, and Worker bindings.
3. Add `wrangler.toml` with preview/prod separation.
4. Implement health endpoints.
5. Implement error schema, correlation ID, CORS, auth middleware skeleton, D1/KV/R2 binding types, and route registration.

Verification:

1. `npm run worker:typecheck`
2. `npm run worker:dev`
3. `GET /health`
4. Negative auth middleware tests once write endpoints exist.

Commit:

1. `feat: add Cloudflare Worker API foundation`

### Phase 5. D1 and Core Trip APIs

Deliverables:

1. Add D1 schema and migrations.
2. Implement users, trips, trip days, trip places, share links, entitlements, ad events, affiliate clicks, and audit log repositories.
3. Implement CRUD endpoints.
4. Enforce ownership checks.
5. Make share links read-only and hard to guess.

Verification:

1. Worker typecheck.
2. Repository tests.
3. Integration tests for create/read/update/delete.
4. Negative tests for unauthorized and cross-user access.

Commit:

1. `feat: add D1 trip persistence and ownership checks`

### Phase 6. Provider Integrations

Deliverables:

1. Implement Naver adapter.
2. Implement Kakao adapter.
3. Implement Tour API adapter.
4. Normalize and deduplicate provider results.
5. Add cache-first lookup.
6. Add route optimization.
7. Add timeout, fallback, and warning behavior.
8. Ensure no fake provider data is used in production.

Verification:

1. Adapter unit tests with fixture responses.
2. Provider failure tests.
3. Search endpoint returns normalized responses.
4. Planner generation can consume normalized provider data.

Commit:

1. `feat: add normalized place provider adapters`

### Phase 7. Monetization

Deliverables:

1. Add ad event logging API.
2. Add affiliate click logging API.
3. Add entitlement verification skeleton.
4. Add mobile premium gate structure.
5. Separate free and premium affordances.
6. Add sponsored place labels in every relevant UI.
7. Write monetization policy docs.

Verification:

1. Entitlement-state UI tests where feasible.
2. Sponsored label visibility checks.
3. Affiliate click API tests.
4. Policy doc review against current store/ad-network requirements before final submission.

Commit:

1. `feat: add monetization scaffolding`

### Phase 8. Deployment, Docs, and Release Gate

Deliverables:

1. Update `README.md`.
2. Add `docs/deployment-cloudflare.md`.
3. Add `docs/env.md`.
4. Add `docs/provider-policy.md`.
5. Add `docs/monetization-policy.md`.
6. Add `docs/privacy-security-checklist.md`.
7. Add sample env files.
8. Add Cloudflare preview deploy instructions.
9. Update root scripts with worker commands.

Verification:

1. `npm test`
2. `npm run mobile:typecheck`
3. `npm run api:build`
4. `npm run planner:build`
5. `npm run worker:typecheck`
6. `npm run check:dev` where local environment allows.
7. Secret scan.

Commit:

1. `docs: add TripMate v1 release operation guide`

## 11. Root Script Target

Target scripts:

```json
{
  "scripts": {
    "test": "npm --prefix packages/planner run test",
    "check:env": "node scripts/dev-readiness-check.mjs",
    "check:health": "npm run mobile:typecheck && npm run api:build && npm run planner:build && npm run worker:typecheck",
    "check:dev": "npm run check:env && npm run check:health",
    "mobile:start": "npm --prefix apps/mobile run start",
    "mobile:web": "npm --prefix apps/mobile run web",
    "mobile:typecheck": "npm --prefix apps/mobile run typecheck",
    "api:dev": "npm --prefix services/api run dev",
    "api:build": "npm --prefix services/api run build",
    "api:start": "npm --prefix services/api run start",
    "planner:build": "npm --prefix packages/planner run build",
    "worker:dev": "npm --prefix services/api-worker run dev",
    "worker:typecheck": "npm --prefix services/api-worker run typecheck",
    "worker:deploy:preview": "npm --prefix services/api-worker run deploy:preview"
  }
}
```

Current root scripts already include `check:env`, `check:health`, `check:dev`, `mobile:*`, `api:*`, `planner:build`, `worker:test`, and `gate:local`. `gate:local` runs Worker unit coverage before API and Worker smoke checks.

## 12. Environment and Secret Policy

Allowed mobile public env:

1. `EXPO_PUBLIC_API_BASE_URL`
2. `EXPO_PUBLIC_MAP_PROVIDER`

Never put these in mobile public env:

1. `NAVER_CLIENT_ID`
2. `NAVER_CLIENT_SECRET`
3. `KAKAO_REST_API_KEY`
4. `DATA_GO_KR_API_KEY`
5. `JWT_ACCESS_SECRET`
6. `JWT_REFRESH_SECRET`
7. `APPLE_SHARED_SECRET`
8. `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

Cloudflare secrets:

1. `JWT_ACCESS_SECRET`
2. `JWT_REFRESH_SECRET`
3. `NAVER_CLIENT_ID`
4. `NAVER_CLIENT_SECRET`
5. `KAKAO_REST_API_KEY`
6. `DATA_GO_KR_API_KEY`
7. `ODSAY_API_KEY`
8. `APPLE_SHARED_SECRET`
9. `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

Cloudflare non-secret vars:

1. `ENVIRONMENT`
2. `CORS_ALLOWED_ORIGINS`
3. `JWT_ISSUER`
4. `JWT_AUDIENCE`
5. `GOOGLE_PLAY_PACKAGE_NAME`

## 13. Final v1.0 Acceptance Criteria

Product:

1. National map-first home works.
2. Region, dates, and style generate a trip draft.
3. Users can inspect and add places from the map.
4. Date-based itinerary uses real normalized place data.
5. Users can replace, delete, reorder, and move places.
6. Route and estimated travel time are visible.
7. Share links are generated.
8. Free and premium behavior is separated.
9. Ads, affiliate clicks, and sponsored-place structures exist.

Technical:

1. Cloudflare Worker API runs.
2. D1 migrations exist.
3. Naver, Kakao, and Tour API adapters exist.
4. Provider cache exists.
5. Auth, ownership, and rate limits exist.
6. Production fake-coordinate guard exists.
7. Root check scripts pass.

Security:

1. No committed secrets.
2. No mobile provider secrets.
3. Write APIs require authentication.
4. Trip ownership is verified.
5. Share links are read-only.
6. Logs minimize personal and location data.

Documentation:

1. README updated.
2. Cloudflare deployment doc exists.
3. Environment variable doc exists.
4. Provider policy doc exists.
5. Monetization policy doc exists.
6. Privacy/security checklist exists.

Testing:

1. `npm test`
2. `npm run mobile:typecheck`
3. `npm run api:build`
4. `npm run planner:build`
5. `npm run worker:typecheck`
6. `npm run check:dev` when local env supports it.

## 14. LazyCodex Execution Prompt

Use this prompt as the active LazyCodex / Goal execution instruction:

```text
You are operating on TripMate in /Users/jyb-m3max/Desktop/codex/tripmate-v1-release-goal.

Goal:
Build TripMate v1.0 into a release-ready domestic Korea trip planner. This is not an MVP. Keep the full v1.0 scope, but implement it phase by phase.

Authority:
Follow docs/tripmate-v1-development-plan.md as the execution contract. If implementation details are missing, choose the smallest approach consistent with the existing repo patterns and the security constraints in that document.

Branch:
Use agent/tripmate-v1-release-goal unless the human explicitly asks for a different branch.

Phase loop:
For each phase, do this in order:
1. Read the current repo state and the relevant section of docs/tripmate-v1-development-plan.md.
2. Write a short implementation plan.
3. Implement only the phase scope.
4. Run the phase verification commands.
5. Fix failures that are caused by the phase changes.
6. Run the security gate.
7. Commit with the phase commit message.
8. Report changed files, tests, risks, and next phase.

Hard rules:
- Do not reduce the request to an MVP.
- Do not put provider secrets in the mobile app.
- Do not show fake production places or synthetic coordinates as real recommendations.
- Do not hide provider failures.
- Do not expose raw lat/lng in normal itinerary UI.
- Do not hide sponsored content.
- Do not make one huge cross-phase commit.
- Do not claim tests passed unless they were run and read.

Start now with Phase 0 if it is not committed. Otherwise continue with Phase 1.
```
