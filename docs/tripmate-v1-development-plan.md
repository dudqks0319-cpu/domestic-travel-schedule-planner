# TripMate v1.0 Development Plan

## Phase 0 Summary

Branch: `feat/tripmate-v1-release-goal`

TripMate v1.0 is a release-grade domestic travel planner, not a reduced MVP. The product target is:

> 전국지도에서 여행지를 고르고, 네이버·카카오·공공 관광 데이터를 바탕으로 날짜별 일정표와 최적 동선을 자동 생성해주는 국내여행 플래너

This plan keeps the existing monorepo boundaries and moves the product forward in small, verifiable phases. Each phase must include a short plan, implementation, deterministic verification, result notes, and one meaningful commit.

## Current Repository Baseline

```text
apps/mobile
  Expo Router React Native app. Contains auth screens, map-first home, trip creation, route map, schedule, search, and profile tabs.

packages/planner
  Shared TypeScript planning primitives. Current coverage includes geo helpers, clustering/order helpers, and basic tests.

services/api
  Existing Node.js Express + Prisma + SQLite reference API. Keep it working until the Worker API reaches parity.

services/api-worker
  Target Cloudflare Workers + D1 production API. Currently documentation-only and must be implemented additively.
```

## Role Split

`services/api` remains the reference/local API during migration. It may receive compatibility fixes, but should not become the new production runtime.

`services/api-worker` is the production API boundary for v1.0. New Cloudflare-specific code, Hono routes, D1 schema, KV/R2 bindings, provider adapters, monetization endpoints, and preview/prod deployment configuration belong here.

`packages/planner` owns pure planning logic: normalized trip inputs, date distribution, route scoring, style rules, meal/rest insertion, and deterministic tests. It must not depend on mobile UI or Cloudflare runtime APIs.

`apps/mobile` owns user experience, local state, provider abstraction for map display, auth gating, trip editing, premium/ad/sponsored UI states, and environment-safe API calls. Provider secrets must never be added here.

## High-Risk Areas

1. Provider secrets leaking into the mobile bundle.
2. Production UI showing synthetic coordinates as real recommendations.
3. Worker implementation accidentally depending on Node-only Express/Prisma patterns.
4. D1 ownership checks being missed on trip/share mutation routes.
5. Planner generating route-like timelines without real place provenance.
6. Monetization UI hiding sponsored content labels or interrupting schedule generation.
7. Large dependency or lockfile churn without phase-level verification.
8. Expo web and native map behavior drifting because native provider SDKs may require EAS Dev Client.

## Phase Plan

### Phase 1. Common Types And Style Keys

Goal: make style selection and trip planning inputs stable across mobile and planner.

Implementation scope:
- Add `apps/mobile/constants/travelStyles.ts`.
- Add shared planner domain types for `NormalizedPlace`, `NormalizedRoute`, `TripPlanInput`, `TripPlanResult`, provider warnings, and regeneration hints.
- Replace title-string style routing with `styleKey`.
- Tighten current trip storage shape enough for schedule/map consumers to avoid fake route ambiguity.

Verification:
- `npm test`
- `npm run mobile:typecheck`
- `npm run planner:build`
- `git diff --check`

Commit target:
- `feat: add v1 travel style and planner domain types`

### Phase 2. Mobile v1.0 UX Foundation

Goal: complete the core user-facing flow without pretending unavailable provider data is real.

Implementation scope:
- Expand nationwide region list and region metadata.
- Add map display provider abstraction with mock/static provider separated from future Naver/Kakao provider.
- Improve trip creation to 3 required steps plus optional advanced inputs.
- Add retry/reload empty states for failed recommendation.
- Improve schedule and route-map state labels for provider warnings and unavailable routes.
- Remove direct user-facing latitude/longitude from schedule cards.

Verification:
- `npm test`
- `npm run mobile:typecheck`
- Expo web smoke check when feasible
- `git diff --check`

Commit target:
- `feat: complete mobile v1 planning flow foundation`

### Phase 3. Planner Engine

Goal: generate actual date-by-date itineraries from normalized places.

Implementation scope:
- Implement day-count calculation and day capacity rules.
- Insert lunch, dinner, cafe/rest slots.
- Add style-specific density and category weighting.
- Add distance-aware grouping and ordering.
- Return `Trip`, `TripDay[]`, `TripPlace[]`, `RouteSummary`, `ProviderWarnings`, and `RegenerationHints`.

Verification:
- Tests for 1-day, 2-day, 3-day, and 5-day trips.
- Tests proving style differences.
- Tests preventing excessive same-day long-distance placement.
- `npm test`
- `npm run planner:build`

Commit target:
- `feat: implement v1 planner engine`

### Phase 4. Cloudflare Worker API Bootstrap

Goal: create the production API runtime without breaking the Express reference API.

Implementation scope:
- Add `services/api-worker/package.json`.
- Add Hono, Wrangler, TypeScript, and Worker types.
- Add `wrangler.toml`.
- Implement `src/index.ts`, health routes, error schema, request id, CORS, and environment bindings.
- Add auth middleware skeleton and rate-limit helper boundary.
- Add root `worker:*` scripts and include Worker typecheck in `check:health`.

Verification:
- `npm run worker:typecheck`
- `npm run worker:dev` with `/health` smoke when feasible
- `npm run check:health`

Commit target:
- `feat: bootstrap cloudflare worker api`

### Phase 5. D1 Schema And Trip APIs

Goal: persist users, trips, days, places, shares, entitlements, ads, affiliates, sponsored places, and audit logs in D1.

Implementation scope:
- Add D1 schema/migrations for required tables.
- Implement query/repository layer.
- Implement trip CRUD, day/place mutations, share link create/read.
- Enforce write auth and trip ownership.
- Use read-only unpredictable share tokens.

Verification:
- Worker typecheck.
- Repository/unit tests where local D1 runner is available.
- Endpoint smoke tests with preview/local D1 when feasible.

Commit target:
- `feat: add d1 schema and trip persistence api`

### Phase 6. Provider Integration

Goal: return normalized places/routes through server-side provider adapters.

Implementation scope:
- Add Naver, Kakao, and Tour API adapters.
- Normalize provider responses into shared types.
- Add deduplication and scoring.
- Implement cache-first place search and route cache keys.
- Add provider timeout, fallback, and warnings.
- Ensure mobile receives unavailable/empty states instead of fake production places.

Verification:
- Adapter normalization tests with fixture responses.
- Worker typecheck.
- Provider routes smoke with secrets present.
- Failure path tests without secrets.

Commit target:
- `feat: add provider adapters and normalized place search`

### Phase 7. Monetization Structure

Goal: make v1 monetization visible in code without violating app store payment boundaries.

Implementation scope:
- Add ad event logging API and mobile logging client.
- Add affiliate click logging API and link model.
- Add entitlement verification skeleton and `me` endpoint.
- Add mobile premium state and feature gates.
- Add sponsored place label rendering.
- Document IAP vs external booking separation.

Verification:
- Worker typecheck.
- Mobile typecheck.
- UI state smoke.

Commit target:
- `feat: add monetization and premium foundations`

### Phase 8. Deployment, Security, And Release Docs

Goal: make the release path operable.

Implementation scope:
- Update README for v1, not MVP wording.
- Add Cloudflare deployment, env, provider policy, monetization policy, and privacy/security checklist docs.
- Add sample env guidance without secrets.
- Add final local gate scripts.
- Run gitleaks-backed commit/push hooks.

Verification:
- `npm test`
- `npm run mobile:typecheck`
- `npm run api:build`
- `npm run planner:build`
- `npm run worker:typecheck`
- `npm run check:dev` when env files are configured

Commit target:
- `docs: add v1 release operations guide`

## Root Script Target

The root scripts should converge to:

```json
{
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
```

Worker scripts must be added only after `services/api-worker` has a real package.

## Environment Boundary

Mobile public environment variables:
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_MAP_PROVIDER`

Never place these values in the mobile app:
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `DATA_GO_KR_API_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `APPLE_SHARED_SECRET`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

Cloudflare secrets:
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `DATA_GO_KR_API_KEY`
- `ODSAY_API_KEY`
- `APPLE_SHARED_SECRET`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

## Phase 0 Result Record

Completed:
- Confirmed current branch baseline was `feat/map-first-cloudflare-mvp`.
- Created v1 branch `feat/tripmate-v1-release-goal`.
- Confirmed the Express API and Worker API roles should remain separate.
- Fixed the development roadmap around release-grade v1.0 scope.

Deferred:
- No runtime code changed in Phase 0.
- No new dependencies added in Phase 0.
- Worker package and root Worker scripts move to Phase 4.

Verification required before Phase 0 commit:
- `npm test`
- `npm run mobile:typecheck`
- `npm run api:build`
- `npm run planner:build`
- `git diff --check`

## Auth Hardening Result Record

Completed:
- Added Worker auth endpoints for Kakao login, token refresh, current user, logout, and account/data deletion.
- Replaced temporary Bearer-string ownership with HMAC-signed access/refresh tokens.
- Stored refresh sessions in D1 and revoked sessions on logout.
- Made account deletion soft-delete user, sessions, trips, trip days, trip places, and share links.
- Updated mobile auth provider to call server logout and account deletion.
- Added a profile-screen entry point for account and data deletion.

Verification completed:
- `npm test`
- `npm run check:health`
- `git diff --check`
- Worker local smoke for login, me, refresh, authenticated trip write, logout revoke, and account deletion.

Remaining risks:
- Production Kakao login still requires real Kakao access token validation against Kakao userinfo.
- Store receipt validation remains a later monetization hardening item.

## Provider Place Detail Result Record

Completed:
- Added D1 query layer for `provider_places`.
- Upsert provider search results into D1 with a seven-day expiry.
- Implemented `GET /api/v1/places/:placeId` from D1 provider place storage.
- Preserved graceful empty search responses when provider secrets are unavailable.

Verification completed:
- `npm test`
- `npm run check:health`
- `git diff --check`
- Worker local smoke for `GET /api/v1/places/:placeId`.
- Worker local smoke for provider-secret-missing search warnings.

Remaining risks:
- Full provider detail freshness depends on real Naver/Kakao/Tour credentials and quota behavior in Cloudflare preview.
- Search result persistence currently happens only after search calls; direct provider detail refresh by provider id can be added later if needed.

## Mobile Search Integration Result Record

Completed:
- Added mobile `placesApi` for Worker normalized place search and detail lookup.
- Replaced legacy tourism/restaurant split search UI with unified provider search.
- Added category filters for attraction, restaurant, cafe, lodging, shopping, nature, museum/exhibition, kids, indoor, and pet travel.
- Added sponsored disclosure through the shared sponsored badge.
- Added "일정에 담기" action that appends real provider coordinates to `currentTrip.routePoints`.
- Preserved empty/error state with "추천 데이터를 다시 불러오기".

Verification completed:
- `npm test`
- `npm run check:health`
- `git diff --check`
- Expo web smoke at `/search` with 390px viewport and zero console errors.

Remaining risks:
- The add-to-trip action currently stores places locally in `currentTrip`; remote trip day selection/persistence should be connected after the mobile saved-trip flow is finalized.
- Real provider search quality still requires configured provider secrets and Cloudflare preview validation.

## Search Remote Persistence Result Record

Completed:
- Added mobile `tripsApi.addPlace()` for `/api/v1/trips/:tripId/places`.
- Updated search "일정에 담기" to store route points with the canonical `latitude` and `longitude` keys.
- Search add-to-trip now attempts remote `trip_places` persistence when `currentTrip.id` is a server trip id.
- If auth or remote persistence fails, the app falls back to local `currentTrip.routePoints` without breaking the user flow.

Verification completed:
- `npm test`
- `npm run check:health`
- `git diff --check`
- Worker local smoke for login, trip create, `/trips/:tripId/places` create/list/delete.
- Expo web smoke at `/search` with 390px viewport and zero console errors.

Remaining risks:
- Search still defaults new places to day 1 until a date-picker/day-selection UI is added to the add-to-trip action.
- Local-only fallback trips cannot be remotely persisted until the user logs in and saves the draft as a server trip.

## Search Day Selection Result Record

Completed:
- Added day selection chips to the mobile search screen based on `currentTrip.startDate` and `currentTrip.endDate`.
- Search add-to-trip now uses the selected day number for local route point metadata.
- Remote `/trips/:tripId/places` persistence now receives the selected `dayNumber`.
- Extended `TripRouteMapPoint` with optional `dayNumber` so local saved places retain their selected itinerary day.

Verification completed:
- `npm test`
- `npm run check:health`
- `git diff --check`
- Expo web smoke at `/search` with 390px viewport and zero console errors.

Remaining risks:
- Search add-to-trip does not yet create missing remote `trip_days` rows automatically; it writes `dayNumber` directly to `trip_places`.
- A fuller saved-trip editor should later expose moving a searched place between days after it is added.

## Trip Day Auto-Link Result Record

Completed:
- Worker trip place creation now auto-creates or reuses the matching `trip_days` row when `dayNumber` is provided.
- `trip_places.day_id` and `trip_places.day_number` are now linked for search-saved places.
- Updating a trip place with a new `dayNumber` also re-links the place to the matching day row.
- Public trip place responses now include `lat` and `lng` for map rendering while UI policy still avoids directly displaying coordinates to users.

Verification completed:
- `npm test`
- `npm run check:health`
- `git diff --check`
- Worker local smoke for login, trip create, place create with `dayNumber=2`, day auto-create, place `dayId` linkage, list, delete.

Remaining risks:
- The mobile saved-trip editor still needs a richer move-between-days UI for already-saved places.
- Real provider/Cloudflare preview validation remains required before release.

## Schedule Place Editing Result Record

Plan:
- Preserve `dayNumber` from locally saved search places on the schedule screen.
- Show saved places by trip day without exposing latitude or longitude to users.
- Allow a saved place to move to the previous/next day or be removed from the local trip draft.
- Invalidate stale optimized route cache after local schedule edits.

Completed:
- Added editable schedule parsing for `currentTrip.routePoints` with canonical `latitude`, `longitude`, and `dayNumber`.
- Kept schedule tabs aligned to the trip date range, even when route segments are missing or fewer than trip days.
- Added a "저장된 장소" section with per-day counts, add-place CTA, previous/next-day movement, and delete action.
- Persisted local edits back to `currentTrip` and cleared `optimizedRoute` so route recalculation cannot reuse stale ordering.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Expo web smoke could not complete in this session because `expo start --web` launched but did not open a listening port before timeout.
- Place move/delete is currently local-first for the active draft; syncing edits to remote `trip_places` should be added after saved trip detail hydration is connected.
- Drag-and-drop ordering and memo/time editing remain separate schedule editor work.

## Schedule Remote Place Sync Result Record

Plan:
- Preserve the Worker `trip_places.id` returned after search add-to-trip calls.
- Store that server id as `tripPlaceId` in local `currentTrip.routePoints`.
- Use direct Worker place mutation endpoints from the schedule editor when `tripPlaceId` is available.
- Keep local edits usable when remote sync fails, with an explicit sync notice.

Completed:
- Extended `TripRouteMapPoint` with `tripPlaceId` and `providerPlaceId`.
- Typed mobile trip place API responses and added direct `updatePlaceById()` / `deletePlaceById()` helpers.
- Updated search add-to-trip persistence to save the returned server `trip_places.id` locally.
- Updated schedule place move/delete actions to call Worker `PATCH /trips/:tripId/places/:placeId` and `DELETE /trips/:tripId/places/:placeId`.
- Added a user-visible sync notice when local edits succeed but remote sync cannot complete.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Existing local route points created before this change do not have `tripPlaceId`, so they remain local-only until trip detail hydration backfills server places.
- Remote sync still depends on authenticated saved trips; guest/local drafts intentionally skip server mutation.

## Saved Trip Hydration Result Record

Plan:
- Add typed mobile DTOs for saved trips and trip places.
- Add a shared helper that loads Worker `trip_places` and writes canonical `currentTrip.routePoints`.
- Update map tab marker loading to fetch saved trip places directly from `GET /trips/:tripId/places`.
- Let users open the selected saved trip marker in the schedule screen.

Completed:
- Added typed `TripDto`, `TripPlaceDto`, and `tripsApi.getPlacesByTrip()`.
- Added `hydrateCurrentTripFromServerTrip()` to preserve `tripPlaceId`, `providerPlaceId`, day number, and real provider coordinates in local draft storage.
- Cleared stale optimized route cache whenever a saved trip is hydrated.
- Updated web and native map tabs to fetch trip places per saved trip instead of assuming nested `days[].places` from the trip list.
- Added "이 여행 일정표 열기" action from selected map marker to the schedule screen.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Marker loading currently fetches places sequentially per trip; batching or a Worker aggregate endpoint may be needed for large trip lists.
- Hydration only starts from a selected marker, so saved trips with zero places still need a separate trip-list detail entry point.

## Saved Trip List Entry Result Record

Plan:
- Keep saved trip markers on the map for place-rich trips.
- Add a saved-trip list entry point that does not depend on marker availability.
- Let saved trips with zero places hydrate into `currentTrip` and open the schedule empty state.

Completed:
- Added a "저장 여행" horizontal rail to both web and native map tabs.
- Stored fetched trips separately from place markers so zero-place saved trips remain visible.
- Reused `hydrateCurrentTripFromServerTrip()` from both marker cards and saved trip cards.
- Updated empty map subtitle to distinguish "saved trips exist" from "no trips exist".

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- The saved trip rail still fetches places sequentially through the marker loader; a server aggregate endpoint remains the scalable path.
- A dedicated trip list/detail screen would give more room for edit/delete/share actions than the map tab rail.

## Mobile Share Link Result Record

Plan:
- Connect the existing Worker `POST /trips/:tripId/share` endpoint from mobile.
- Add a schedule-screen share action for saved server trips.
- Keep guest/local drafts blocked from share creation with a clear login/save message.
- Use native share sheet where available and clipboard fallback on web.

Completed:
- Added typed `TripShareDto`, `tripsApi.createShare()`, and `buildTripShareUrl()`.
- Added "공유 링크 만들기" to the schedule screen.
- Created read-only Worker share URLs from returned share tokens.
- Added web clipboard copy and native `Share.share()` handling.
- Added user-facing failure and local-draft guard messages.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- The share URL currently points to the Worker JSON read-only endpoint; a user-friendly public share page remains a release polish item.
- Mobile share creation still requires an authenticated saved trip, which is intentional for v1 privacy and ownership enforcement.

## Share Read-Only Detail Result Record

Plan:
- Expand the public share lookup response beyond trip metadata.
- Include read-only trip days and trip places without requiring authentication.
- Preserve ownership boundaries by resolving data through the shared trip owner id.

Completed:
- Updated `GET /api/v1/share/:shareId` to include `trip.days`.
- Added read-only `places` arrays per shared day.
- Added a flat `trip.places` array for clients that need direct map rendering.
- Kept expired/deleted share link filtering unchanged.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- The response is still JSON and not yet a user-facing HTML/share page.
- Shared places include lat/lng for map rendering; public share pages must avoid presenting raw coordinates as primary user-facing content.

## Public Share Page Result Record

Plan:
- Add a public read-only HTML share page on the Worker.
- Route mobile-generated share URLs to the public page instead of the JSON API endpoint.
- Show trip days and places while keeping raw latitude/longitude hidden from users.

Completed:
- Added `GET /share/:shareId` Worker route for public TripMate share pages.
- Rendered trip title, destination, date range, day sections, place category, address, memo, time, and sponsor disclosure.
- Added an expired/deleted share fallback page.
- Changed mobile `buildTripShareUrl()` to generate `/share/:token` URLs.
- Kept `GET /api/v1/share/:shareId` as the JSON read-only API for clients.

Verification completed:
- `npm run worker:typecheck`
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- The public share page has not yet been browser-smoked against a local Worker with seeded D1 data.
- The page is static HTML; richer map previews or export thumbnails can be layered later through R2.

## Saved Trip Aggregate List Result Record

Plan:
- Remove trip-by-trip place fetching from the mobile map tab.
- Extend the Worker trip list endpoint with an opt-in aggregate response.
- Preserve the existing `GET /trips` response for clients that only need trip metadata.

Completed:
- Added `listTripPlacesForUser()` in the Worker D1 query layer.
- Added `GET /api/v1/trips?include=places` support that returns each trip with its `places` array.
- Added typed mobile `TripWithPlacesDto` and `tripsApi.listWithPlaces()`.
- Updated web and native map tabs to render markers and saved trip rail from one aggregate request.

Verification completed:
- `npm run worker:typecheck`
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- The aggregate response includes all saved trip places for the authenticated user; pagination or date filtering may be needed after real usage volume is known.
- A dedicated trip list/detail screen is still better suited for bulk manage/delete/share actions.

## Profile Saved Trip Management Result Record

Plan:
- Replace static profile "내 여행" examples with real saved trips.
- Provide saved trip open, share, and delete actions from a management surface.
- Reuse existing hydration and share link helpers so schedule state stays canonical.

Completed:
- Removed hardcoded profile trip cards.
- Loaded saved trips through `tripsApi.listWithPlaces()`.
- Added saved trip empty, loading, retry, and error states.
- Connected "열기" to `hydrateCurrentTripFromServerTrip()` and the schedule screen.
- Connected "공유" to Worker share link creation and native/web share behavior.
- Connected "삭제" to `DELETE /api/v1/trips/:tripId` with confirmation.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Profile trip management is still compact; a dedicated full-screen trip manager would handle bulk operations and filters better.
- Delete/share flows require an authenticated saved trip, which is expected but should be covered by device-level smoke tests before release.

## Route Fallback Safety Result Record

Plan:
- Re-check remaining fallback/synthetic route surfaces.
- Keep development preview behavior available only in development/test.
- Make production fallback route displays impossible to mistake for real provider directions.

Completed:
- Confirmed synthetic trip selection points are gated by `NODE_ENV === "development" || "test"`.
- Added production-only fallback safety notice on the route map screen.
- Added retry and "장소 다시 담기" actions when only estimated fallback routing is available.
- Rendered fallback map polylines as dashed/low-confidence routes in web and native map views.
- Added explicit copy that fallback routes are estimated connection lines, not real road/transit/walking directions.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Real provider failure modes still need Cloudflare preview smoke with configured provider secrets.
- The existing Worker route optimizer still returns fallback estimates when live routing is unavailable; this is acceptable only while UI clearly labels the result as estimated.

## Affiliate CTA Result Record

Plan:
- Connect mobile affiliate UI to the existing Worker affiliate click logging endpoint.
- Keep external bookings separate from digital premium purchases.
- Avoid hardcoded partner links and require public HTTPS configuration.

Completed:
- Added `apps/mobile/services/affiliateOffers.ts` with hotel, rental car, ticket, insurance, and local tour offers.
- Added schedule-screen "예약/제휴" CTA section after the itinerary.
- Logged clicks through `logAffiliateClick()` before opening configured external booking URLs.
- Added disabled/link-missing UI copy when affiliate URLs are not configured.
- Documented optional public affiliate URL env vars and no-hardcoded-partner-link policy.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Real affiliate URLs must be configured through public env after partner contracts are finalized.
- Device-level smoke is still needed to verify `Linking.openURL()` behavior for each partner URL.

## Schedule Export Gate Result Record

Plan:
- Add a schedule export surface that distinguishes free and premium behavior.
- Use the existing entitlement API state instead of local-only feature flags.
- Log free export attempts as monetization events without interrupting itinerary generation.
- Keep PDF export as a server/R2-ready path while enabling image capture on supported devices.

Completed:
- Added a schedule-screen export section after itinerary content and before affiliate CTAs.
- Wrapped itinerary content in a capture target for premium image export.
- Connected free export attempts to `logAdEvent()` with the `free_export` placement.
- Gated image/PDF export by `entitlement.benefits.exportEnabled`.
- Added user-safe notices for premium gating, capture failure, and PDF export preparation.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- PDF generation still needs a Worker/R2 export job implementation before production launch.
- Device-level smoke is still needed for `react-native-view-shot` capture and native share behavior.

## Worker Export Preparation Result Record

Plan:
- Add a premium-gated Worker endpoint that prepares trip exports without introducing a PDF rendering dependency.
- Store an export manifest in R2 so a later async renderer can generate PDF/image assets from canonical trip data.
- Persist export job metadata in D1 with ownership boundaries.
- Keep returned client data free of raw R2 object keys and private manifest details.

Completed:
- Added `trip_exports` D1 schema and migration.
- Added Worker DB helpers for creating and reading owned trip export records.
- Added `POST /api/v1/trips/:tripId/exports` with auth, trip ownership, active entitlement check, and R2 manifest storage.
- Added `GET /api/v1/trips/:tripId/exports/:exportId` for owned export job status lookup.
- Updated the API Worker README to reflect current implemented endpoints and remaining export work.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- The endpoint prepares a manifest and queued job record; a separate renderer is still needed for final PDF/image files.
- This risk was later reduced by authenticated export download endpoints, print-ready HTML assets, and scheduled expired export cleanup.

## Mobile Export API Connection Result Record

Plan:
- Add typed mobile API methods for Worker trip export jobs.
- Connect the schedule PDF export button to the premium-gated Worker endpoint.
- Keep free users and guest/local drafts on safe explanatory notices.
- Avoid exposing R2 keys or assuming a final PDF download exists before renderer work is complete.

Completed:
- Added `TripExportDto`, `tripsApi.createExport()`, and `tripsApi.getExport()` to the mobile API client.
- Connected schedule PDF export to `POST /api/v1/trips/:tripId/exports`.
- Kept entitlement, saved-trip, and network failure states user-visible on the schedule screen.
- Reused the same export loading state for image capture and server PDF export preparation.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- PDF export now returns an authenticated download URL when the Worker creates a print-ready HTML asset; image export remains queued for server-side rendering.
- Device-level smoke is needed with an authenticated premium account to verify the full mobile request path.

## Export Asset Download Result Record

Plan:
- Move export jobs beyond manifest-only output by creating an owned downloadable asset.
- Generate a print-ready export page in R2 for premium PDF requests without adding a rendering dependency.
- Add an authenticated download endpoint so R2 object keys are not exposed to clients.
- Open the returned export URL from the mobile schedule PDF action when the asset is ready.

Completed:
- Added Worker export download URLs for ready export records.
- Added `GET /api/v1/trips/:tripId/exports/:exportId/download` with auth and trip export ownership checks.
- Stored print-ready HTML export assets in R2 for PDF export requests and marked those jobs `ready`.
- Kept image export requests as queued server jobs because mobile still handles image capture locally.
- Connected mobile schedule PDF export to open the returned ready export URL.
- Updated the Worker README to distinguish current R2-backed download support from remaining binary renderer work.

Verification completed:
- `npm run mobile:typecheck`
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- The current PDF path provides a print-ready HTML page for PDF saving; a true binary PDF renderer is still needed for one-tap PDF file delivery.
- Download access is authenticated rather than publicly signed; shared export links need a separate token model if required later.

## Entitlement Verification Hardening Result Record

Plan:
- Prevent the mobile client from granting itself premium by submitting an arbitrary `active` status.
- Keep Apple/Google receipt submission server-side and privacy-safe while live store validation is not implemented.
- Allow manual entitlement activation only outside production for testing/operations.
- Add mobile API and profile UX boundaries for future purchase restore without adding a billing SDK dependency.

Completed:
- Hardened `POST /api/v1/monetization/entitlements/verify` so Apple/Google requests resolve to `pending` until live store validation exists.
- Added environment-aware manual entitlement handling that refuses manual production activation.
- Kept raw receipts/transaction ids out of D1 by hashing the submitted value before persistence.
- Added typed mobile `verifyEntitlement()` API boundary for future IAP SDK integration.
- Added a profile-screen "구매 복원/권한 확인" action that refreshes current entitlement state and explains that store SDK receipt submission is pending.
- Updated the monetization policy with client-trust and receipt-storage rules.

Verification completed:
- `npm run mobile:typecheck`
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Live Apple App Store Server API and Google Play Developer API validation are still not implemented.
- The mobile app still needs a real IAP SDK integration before store purchase/restore can submit actual receipts.

## Worker Rate Limit Result Record

Plan:
- Add a shared Worker rate-limit middleware using the existing Cloudflare KV binding.
- Apply it before provider/cost-sensitive operations.
- Use authenticated user id when available and client IP for public/guest traffic.
- Return standard rate-limit headers and a safe 429 error message.

Completed:
- Added `services/api-worker/src/middleware/rate-limit.ts`.
- Applied rate limits to place search, planner generation, route optimization, and trip export creation.
- Added per-endpoint limits for provider calls and export asset creation.
- Documented the current limits and identifier policy in `docs/provider-policy.md`.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- KV increments are not atomic, so extremely concurrent bursts may exceed the exact limit slightly.
- Production limits should be tuned after real Cloudflare analytics and provider quota data are available.

## Audit Logging Result Record

Plan:
- Start using the existing `audit_logs` table for security-relevant write operations.
- Keep audit metadata privacy-safe with an allowlist and no raw payload storage.
- Record request correlation id and entity ids for operational investigation.
- Cover trip, schedule edit, sharing, export, and entitlement verification writes.

Completed:
- Added `services/api-worker/src/db/audit.ts` with allowlisted metadata persistence.
- Added audit records for trip create/update/delete.
- Added audit records for trip day and trip place create/update/delete.
- Added audit records for share link creation and trip export creation.
- Added audit records for entitlement verification without storing raw receipts or transaction ids.
- Updated the privacy/security checklist with audit metadata and write-operation coverage rules.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Audit logs currently do not have a retention/deletion policy beyond D1 data ownership cleanup.
- Provider latency/error metrics are still structured-log oriented and not yet persisted as operational counters.

## Account Deletion Audit Anonymization Result Record

Plan:
- Align the new audit logging with account/data deletion expectations.
- Preserve non-personal operational audit history while removing account linkage.
- Record account deletion itself without retaining the deleted user id afterward.

Completed:
- Added `anonymizeAuditLogsForUser()` to null out `audit_logs.user_id`.
- Updated `DELETE /api/v1/auth/me` to create a `user.delete` audit event and then anonymize all audit logs for that user.
- Updated the privacy/security checklist with audit anonymization expectations.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Audit logs still need an explicit time-based retention policy for production operations.
- Entity ids in historical audit logs may reference deleted records; they should be treated as operational identifiers, not user-facing recovery handles.

## Account Deletion Coverage Result Record

Plan:
- Re-check account deletion against the current v1.0 D1 schema.
- Extend deletion beyond the original trip/session/share tables.
- Soft-delete revocable user-owned records and anonymize event-style monetization rows.

Completed:
- Updated `deleteUserData()` to expire trip export jobs on account deletion.
- Updated `deleteUserData()` to revoke subscription entitlements on account deletion.
- Updated `deleteUserData()` to null out `ad_events.user_id`.
- Updated `deleteUserData()` to null out `affiliate_clicks.user_id` and `affiliate_clicks.trip_id`.
- Updated the privacy/security checklist with entitlement/export/ad/affiliate deletion coverage.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- R2 export object deletion is handled in the account deletion route, but bucket lifecycle cleanup should still be configured as defense in depth.
- Event tables intentionally keep aggregate business events after ownership is removed.

## Account Deletion R2 Export Cleanup Result Record

Plan:
- Remove user-owned export artifacts from R2 during account deletion.
- Query export manifest and asset keys before DB records are expired.
- Delete R2 objects before DB ownership cleanup so incomplete object cleanup fails the deletion request.

Completed:
- Added `listUserTripExportObjectKeys()` to collect manifest and asset object keys from active trip export records.
- Updated `DELETE /api/v1/auth/me` to delete owned R2 export objects before `deleteUserData()`.
- Updated the privacy/security checklist with R2 export cleanup coverage.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- If R2 deletion succeeds but later D1 cleanup fails, DB records may reference missing export objects; this is preferable to retaining deleted-account export data but should be monitored.
- A bucket lifecycle policy is still recommended for orphaned objects and defense in depth.

## Operational Events Result Record

Plan:
- Add privacy-safe D1 operational events for release observability.
- Record latency and success/warning status for provider-heavy and route-heavy endpoints.
- Keep metadata allowlisted and avoid raw request bodies, provider payloads, tokens, receipts, or precise coordinates.
- Document the new migration and operational event policy.

Completed:
- Added `operational_events` to the Worker schema and `0003_operational_events.sql` migration.
- Added `recordOperationalEvent()` with allowlisted metadata and non-blocking write failure handling.
- Recorded place search cache status, place count, warning count, and latency.
- Recorded planner generation style, mode, cache status, place count, warning count, and latency.
- Recorded route optimization mode, point/segment count, fallback warning count, and latency.
- Updated Cloudflare deployment docs with all migrations and operational event privacy rules.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Operational events are append-only; retention/aggregation jobs are still needed for long-term production operations.
- Provider-specific latency is still aggregated at endpoint level rather than split per provider adapter.

## Provider Adapter Operational Events Result Record

Plan:
- Split provider observability from endpoint-level place search metrics.
- Record Naver, Kakao, and Tour adapter search success/warning/failure separately.
- Keep provider metrics privacy-safe with counts and latency only.

Completed:
- Added `provider` to the operational event metadata allowlist.
- Wrapped each place provider adapter search with operational event recording.
- Recorded adapter target, status, duration, provider name, place count, and warning count on cache misses.
- Updated Cloudflare deployment docs to describe provider adapter operational events.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Adapter events are not emitted on cache hits because no external provider call occurs.
- Provider-specific aggregation dashboards are still not implemented; the raw events are available in D1.

## Ops Summary API Result Record

Plan:
- Add a small admin-only endpoint for release operations without exposing raw events.
- Protect operational summaries with a server-only `OPS_ADMIN_TOKEN`.
- Summarize operational events, ad events, affiliate clicks, and entitlement counts.
- Document the required secret and usage.

Completed:
- Added `OPS_ADMIN_TOKEN` to Worker bindings and environment documentation.
- Added `GET /api/v1/ops/summary?hours=24`.
- Protected `/api/v1/ops/*` with `Authorization: Bearer` or `x-ops-token`.
- Summarized grouped operational events with counts and duration aggregates.
- Summarized ad events, affiliate clicks, and entitlement states.
- Updated Cloudflare deployment docs with the admin summary curl example.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- This is an API-only admin surface, not a UI dashboard.
- Token rotation and audit for ops summary access are not implemented yet.

## Ops Summary Audit Result Record

Plan:
- Record admin summary reads as privacy-safe audit events.
- Keep `OPS_ADMIN_TOKEN` out of logs and audit metadata.
- Document token rotation expectations for release operations.

Completed:
- Added `windowHours` to the audit metadata allowlist.
- Added `ops.summary.read` audit creation to `GET /api/v1/ops/summary`.
- Documented `OPS_ADMIN_TOKEN` rotation and mobile-bundle exclusion expectations.
- Added the ops summary audit requirement to the privacy and security checklist.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- This still depends on a manually managed operations token rather than per-operator admin accounts.
- Ops summary audit records are API-level evidence only; there is still no admin UI.

## Planner Replan and Worker Smoke Result Record

Plan:
- Replace the `planner/replan` placeholder with a real replan response.
- Prefer client-provided current places for replan and search providers only when more places are needed.
- Add a local/preview Worker smoke script for the v1 release API contract.
- Keep smoke writes out of production and document cleanup behavior.

Completed:
- Implemented `POST /api/v1/planner/replan` with retained, locked, removed, and replacement-query place handling.
- Recorded `planner_replan` operational events with privacy-safe metadata.
- Added `npm run worker:smoke` using `scripts/worker-v1-smoke.mjs`.
- Covered health, planner generate/replan, route optimize, places search/detail when available, Kakao dev login, trip/day/place/share CRUD, monetization events, entitlement state, optional ops summary, cleanup, and logout in the smoke script.
- Documented local/preview smoke usage and the production write-smoke prohibition.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:health`
- `node scripts/worker-v1-smoke.mjs --help`
- `node --check scripts/worker-v1-smoke.mjs`
- `git diff --check`

Remaining risks:
- The smoke script has not been run against a live Worker in this Phase because no Worker process and D1 preview binding are guaranteed to be active.
- Live preview smoke still needs configured D1/KV/R2 resources and provider secrets.

## Worker Smoke Production Guard Result Record

Plan:
- Prevent the v1 smoke script from sending write requests to production by mistake.
- Use the Worker health response as the environment source of truth.
- Document the executable guard, not only the operating convention.

Completed:
- Added a `/health` and `/api/v1/health` environment check before any write smoke step.
- Made `worker:smoke` refuse to continue unless `ENVIRONMENT` is `local` or `preview`.
- Updated the smoke help text and Cloudflare deployment guide to describe the executable guard.

Verification completed:
- `node --check scripts/worker-v1-smoke.mjs`
- `npm run worker:smoke -- --help`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- The guard depends on the deployed Worker health response exposing the correct `ENVIRONMENT` value.
- Live preview smoke still needs an actual Worker URL and configured D1/KV/R2 bindings.

## Cloudflare Readiness Check Result Record

Plan:
- Keep local `check:env` usable while adding strict preview/production deploy checks.
- Fail if mobile `.env` contains server-only secrets.
- Fail preview/production deploy checks when D1/KV/R2 bindings still contain placeholder IDs.
- Fail production deploy checks if production origins still use localhost, loopback, or example domains.

Completed:
- Added `--target local|preview|production` support to `scripts/dev-readiness-check.mjs`.
- Added `check:env:preview` and `check:env:production` root scripts.
- Added mobile `.env` forbidden key detection for provider, JWT, billing, and ops secrets.
- Added strict Cloudflare preview/production `wrangler.toml` readiness checks.
- Updated Cloudflare deployment and environment docs with the new readiness gates.

Verification completed:
- `node --check scripts/dev-readiness-check.mjs`
- `npm run check:env` passed with local warnings for missing ignored env files and unresolved deploy placeholders.
- `npm run check:env:preview` failed as expected while preview D1/KV placeholder IDs remain.
- `npm run check:env:production` failed as expected while production D1/KV placeholder IDs and example origin remain.
- `npm test`
- `npm run check:health`
- `npm run check:dev`
- `git diff --check`

Remaining risks:
- The readiness checker is a lightweight TOML text check, not a full Wrangler deploy validation.
- Preview/production checks will intentionally fail until real Cloudflare resource IDs and production origins are configured.

## Mobile Worker API Base Result Record

Plan:
- Align mobile default API base URLs with the Cloudflare Worker v1 API.
- Normalize `EXPO_PUBLIC_API_BASE_URL` whether it is set to the Worker origin, `/api`, or `/api/v1`.
- Keep share links on the Worker origin `/share/:token`, not under `/api/v1`.
- Make route optimization call the Worker `/api/v1/routes/optimize` contract first.

Completed:
- Added `apps/mobile/services/apiBase.ts` with HTTPS/loopback validation and `/api/v1` normalization.
- Updated the main Axios client to default to `http://localhost:8787/api/v1`.
- Updated share URL generation to use the Worker origin `/share/:token`.
- Updated route optimization to use the normalized Worker v1 base URL and primary `/routes/optimize` endpoint.
- Added Worker route response normalization for `route.provider`, `orderedPoints`, `segments`, totals, and warnings.
- Updated local readiness messaging to the Worker default API URL.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `npm run check:env`
- `git diff --check`

Remaining risks:
- Device-level route optimization smoke still needs a running Worker and map screen interaction.
- `EXPO_PUBLIC_API_BASE_URL` must point at a smoke-verified preview/prod Worker before app-store release.

## Mobile Planner Replan Contract Result Record

Plan:
- Align mobile `plannerApi.replan` with the Worker v1 `POST /api/v1/planner/replan` endpoint.
- Add request typing for current places, locked places, removed places, and replacement search.
- Keep the existing generate helper compatible with both `mode` and transport naming used across the app.

Completed:
- Added `PlannerGenerateParams` and `PlannerReplanParams` mobile service types.
- Changed `plannerApi.replan` from the obsolete `/planner/trips/:tripId/replan` path to `/planner/replan`.
- Added fields for `places`, `lockedPlaceIds`, `removedPlaceIds`, and `replacementQuery` so the mobile app can call the Worker replan contract.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- No screen currently invokes `plannerApi.replan`; a later UI Phase still needs to wire this to the schedule regeneration action.
- `plannerApi.summary` and `plannerApi.suggestions` still point to legacy/non-Worker endpoints and should be removed or implemented in a later Phase.

## Mobile Planner Legacy Helper Cleanup Result Record

Plan:
- Remove unused mobile planner helpers that point to legacy/non-Worker endpoints.
- Keep `plannerApi` limited to Worker v1 implemented planner routes.
- Verify no screen imports the removed helpers.

Completed:
- Removed `plannerApi.summary` and `plannerApi.suggestions` from the mobile API service.
- Kept `plannerApi.generate` and `plannerApi.replan` aligned with Worker `/planner/generate` and `/planner/replan`.
- Confirmed no app screen currently calls the removed helpers.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `rg "plannerApi\\.(summary|suggestions)" apps/mobile`
- `git diff --check`

Remaining risks:
- Destination suggestions are not currently a Worker v1 endpoint; if the product needs them later, implement them server-side instead of restoring legacy paths.

## Schedule Advanced Replan Result Record

Plan:
- Connect the schedule screen premium advanced replan action to the Worker `/planner/replan` API.
- Return normalized places from Worker replan so mobile can rebuild route points with coordinates.
- Keep free users behind a premium gate and log the request as a monetization event.
- Persist replanned place order back into `currentTrip` and clear stale optimized routes.

Completed:
- Extended Worker replan responses with the normalized places used by the planner.
- Added schedule-screen replan request/response mapping and coordinate restoration.
- Added a premium-gated "고급 일정 재생성" card to the schedule screen.
- Replanned schedules now update local route points, reset active day, and clear stale route optimization.
- Added a smoke assertion that `/planner/replan` returns normalized places for route rebuild.

Verification completed:
- `npm run mobile:typecheck`
- `npm run worker:typecheck`
- `npm test`
- `node --check scripts/worker-v1-smoke.mjs`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- Device-level smoke with a premium entitlement is still needed to verify the full tap-to-replan user flow.
- Replanned local order is not yet written back to remote `trip_places` ordering; the persisted remote trip remains the source for saved trips.

## Schedule Replan Remote Sync Result Record

Plan:
- Preserve `tripPlaceId` when converting Worker replan results back into mobile route points.
- Patch existing remote `trip_places` after replan so saved trips and share data can reflect the new day/order.
- Avoid creating duplicate remote places for provider results that were newly suggested during replan.

Completed:
- Added an existing-point lookup by route id and provider place id.
- Preserved `tripPlaceId` for replanned places that match already saved trip places.
- Added remote sync after successful replan using `PATCH /api/v1/trips/:tripId/places/:placeId`.
- Synced `dayNumber` and `sortOrder` for saved places while skipping unsaved provider suggestions.
- Updated user-facing replan notice with the number of remote places synced.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `git diff --check`

Remaining risks:
- New provider suggestions created during replan are still local-only until the user explicitly saves/adds them.
- Remote sync is sequential; large itineraries may need batching or a bulk endpoint later.

## Trip Place Bulk Reorder Result Record

Plan:
- Replace mobile replan remote sync's multiple place PATCH requests with one owned bulk reorder request.
- Reuse existing Worker trip ownership and day-number resolution logic.
- Add smoke coverage for the new reorder endpoint.

Completed:
- Added `PATCH /api/v1/trips/:tripId/places/reorder`.
- Validated non-empty reorder payloads, positive integer day/order values, duplicate place ids, and owned trip places before mutation.
- Reused `updateTripPlace()` so `dayNumber` still creates or resolves the correct `trip_days` row.
- Added one audit log record for the reorder operation.
- Added typed mobile `tripsApi.reorderPlaces()`.
- Updated schedule replan remote sync to send saved places in one bulk request while skipping unsaved provider suggestions.
- Added Worker smoke script coverage for the reorder endpoint.

Verification completed:
- `npm test`
- `npm run check:health`
- `node --check scripts/worker-v1-smoke.mjs`
- `git diff --check`

Remaining risks:
- Reorder updates are still sequential inside the Worker; this avoids many mobile network calls but is not a D1 transaction.
- New provider suggestions created during replan remain local-only until the user explicitly saves/adds them.

## Replan Suggested Place Persistence Result Record

Plan:
- Keep the local-first replan UX, but persist newly suggested provider places for authenticated saved trips.
- Avoid duplicate remote places by matching existing saved places before creating missing ones.
- Store returned `tripPlaceId` values back into `currentTrip.routePoints` so later move/delete/share/export actions use canonical server ids.

Completed:
- Added schedule-screen matching by `providerPlaceId` and normalized name/coordinate key.
- Loaded existing remote `trip_places` before creating missing replanned places.
- Created only unmatched replanned places with category, address, coordinates, sponsorship label, day number, and sort order.
- Reused the bulk reorder endpoint after creation so saved trips and share/export views reflect the final replan order.
- Persisted newly created or relinked `tripPlaceId` values back into local `currentTrip` storage.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`

Remaining risks:
- New place creation still happens sequentially from mobile; a future Worker sync endpoint could create/reorder in one authenticated server-side operation.

## Worker Replan Place Sync Endpoint Result Record

Plan:
- Move saved-trip replan place creation/relink/reorder from multiple mobile requests into one authenticated Worker endpoint.
- Keep local-first replan UX while returning `clientId -> tripPlaceId` mappings for local storage hydration.
- Preserve ownership checks by operating only on `trip_places` loaded through the authenticated trip owner.

Completed:
- Added `PATCH /api/v1/trips/:tripId/places/sync`.
- Validated non-empty sync payloads, client ids, coordinates, positive day/order values, and max payload size.
- Matched existing saved places by owned `tripPlaceId`, provider place id, then normalized name/coordinate key.
- Created missing replanned places on the Worker, then applied final day/order updates server-side.
- Returned sync stats and client id mappings to mobile.
- Updated mobile schedule replan sync to call one Worker endpoint and hydrate returned `tripPlaceId` values.
- Added Worker smoke coverage and README implementation notes for the sync endpoint.

Verification completed:
- `npm run mobile:typecheck`
- `npm --prefix services/api-worker run typecheck`
- `npm test`
- `npm run check:health`
- `node --check scripts/worker-v1-smoke.mjs`
- `git diff --check`

Remaining risks:
- The endpoint performs sequential D1 writes internally; a stricter transactional/batch strategy should be considered if D1 transaction support is introduced in the project.

## Release Contract Gate Result Record

Plan:
- Add a deterministic local gate that catches drift between the v1 release requirements, Worker endpoints, D1 schema, root scripts, docs, and mobile secret boundaries.
- Keep the check dependency-free and safe to run in local, CI, preview, and production readiness contexts.
- Wire the gate into `check:dev` so it runs before broad local release checks.

Completed:
- Added `scripts/release-contract-check.mjs`.
- Verified required root scripts, required release docs, Worker route contracts, D1 schema tables, mobile public env examples, and server-only secret names outside the mobile bundle path.
- Added `npm run check:release-contract`.
- Included the release contract check in `npm run check:dev`.
- Updated README and Cloudflare deployment docs with the new gate.

Verification completed:
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- This is a static contract check; it complements but does not replace live Worker smoke against local/preview D1/KV/R2 bindings.
- Local `check:dev` still reports expected warnings for missing local env files and placeholder preview/production Cloudflare resource ids.

## Production Fallback Guard Contract Result Record

Plan:
- Re-check mobile fallback/synthetic coordinate surfaces.
- Make fallback timeline copy production-safe.
- Extend release contract checks so production synthetic-place and estimated-route labeling cannot regress silently.

Completed:
- Replaced the schedule fallback timeline copy that implied the view was development-only.
- Added release contract checks for development/test-only synthetic preview point guards in schedule and route-map screens.
- Added release contract checks for production fallback warning copy on the route-map screen.
- Added release contract checks for estimated route notices and dashed estimated polylines in native and web map views.
- Added a release contract check that route optimization does not silently fallback on non-recoverable provider errors.

Verification completed:
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- This is still a static check; final release needs device/browser smoke to verify the warning and dashed route affordances render correctly.

## GitHub Actions Release Gate Result Record

Plan:
- Add CI coverage for the deterministic v1 release gates that already pass locally.
- Keep CI free of production secrets and live provider calls.
- Make the release contract check assert that the CI gate itself stays present.

Completed:
- Added `.github/workflows/tripmate-v1-gate.yml`.
- The workflow runs on pull requests and pushes to `main`, `develop`, and `feat/tripmate-v1-release-goal`.
- The workflow uses Node 20, `npm ci`, `npm run check:release-contract`, `npm test`, `npm run check:health`, and Worker smoke script syntax checks.
- Updated release contract checks to require the workflow and its core commands.
- Updated README and Cloudflare deployment docs with CI gate expectations.

Verification completed:
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:dev`
- `node --check scripts/worker-v1-smoke.mjs`

Remaining risks:
- This does not run live Worker smoke because CI has no D1/KV/R2 bindings or provider secrets by default.

## Preview Worker Smoke Workflow Result Record

Plan:
- Add a manual GitHub Actions path for live preview Worker smoke without requiring production secrets in the regular PR gate.
- Reuse the existing write-smoke script and its `/health` environment guard.
- Make release contract checks assert that the manual preview smoke workflow remains available.

Completed:
- Added `.github/workflows/tripmate-worker-preview-smoke.yml`.
- The workflow is `workflow_dispatch` only and requires a `base_url` input.
- The workflow installs dependencies with `npm ci`, checks Worker smoke script syntax, and runs `npm run worker:smoke` against the provided base URL.
- The workflow passes `OPS_ADMIN_TOKEN` from repository secrets when available.
- Updated release contract checks to require the preview smoke workflow and its safety-critical commands.
- Updated README and Cloudflare deployment docs with manual preview smoke guidance.

Verification completed:
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `node --check scripts/worker-v1-smoke.mjs`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- The workflow was added and statically verified locally, but it has not been run against a real preview Worker URL in this session.

## Search Remote Day Auto-Link Smoke Result Record

Plan:
- Lock the Worker contract used by mobile search add-to-trip when the client sends `dayNumber` without an explicit `dayId`.
- Make the smoke script prove that the Worker creates/reuses a matching `trip_days` row and returns the linked `dayId`.
- Add a release contract assertion so this smoke coverage is not removed accidentally.

Completed:
- Added a Worker smoke step that creates a trip place with `dayNumber: 2` and no `dayId`.
- Asserted that the response includes a linked `dayId` and `dayNumber === 2`.
- Added release contract checks for the day auto-link smoke assertion.

Verification completed:
- `node --check scripts/worker-v1-smoke.mjs`
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- This verifies the Worker contract statically and in smoke script syntax locally; live preview smoke still requires a configured preview Worker.

## Mobile Account Deletion Local Cleanup Result Record

Plan:
- Re-check the account deletion path after the Worker-side deletion and R2 export cleanup work.
- Clear user-owned local draft data after account deletion; logout cleanup was later expanded to clear the same local trip draft and route cache.
- Centralize the mobile `currentTrip` storage key so cleanup and itinerary screens cannot drift.

Completed:
- Added `apps/mobile/services/localTripStorage.ts` with the canonical `CURRENT_TRIP_STORAGE_KEY`.
- Added `clearLocalTripDraftData()` to remove `currentTrip` and the cached `optimizedRoute`.
- Wired `deleteAccount()` to clear auth tokens, user profile, local trip draft data, and cached route data after the Worker deletion succeeds.
- Updated trip create, schedule, route map, search, and hydration code to use the shared storage key.
- Updated the profile account deletion warning copy to mention local temporary itinerary data and export file deletion.
- Updated the privacy/security checklist with mobile local cleanup coverage.

Verification completed:
- `git diff --check`
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Ordinary logout later clears local trip drafts and cached optimized routes to prevent account-switch data exposure on shared devices.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Ops Retention Policy Result Record

Plan:
- Reduce the remaining audit/operations retention risk with an explicit Worker-side operations endpoint.
- Keep the endpoint behind `OPS_ADMIN_TOKEN`, provide a dry-run mode, and log a privacy-safe audit event for every run.
- Cover the endpoint in release contract checks and optional preview smoke.

Completed:
- Added D1 helpers to count/delete old `audit_logs` by retention days.
- Added D1 helpers to count/delete old `operational_events` by retention days.
- Added `POST /api/v1/ops/retention` with default `auditDays=365`, `operationalDays=90`, and `dryRun=true` support.
- Added `ops.retention.run` audit logging with allowlisted count/retention metadata.
- Added optional Worker smoke coverage for `/api/v1/ops/retention?dryRun=true`.
- Added release contract checks for the ops retention route and smoke coverage.
- Updated Cloudflare deployment docs and the privacy/security checklist.

Verification completed:
- `npm run worker:typecheck`
- `node --check scripts/worker-v1-smoke.mjs`
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:dev`
- `git diff --check`

Remaining risks:
- Actual production retention cadence still needs to be wired to trusted operator automation or a scheduled Worker trigger after Cloudflare resources are configured.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Scheduled Ops Retention Result Record

Plan:
- Convert the manual retention endpoint into an automated production operations path.
- Use Cloudflare Workers scheduled handler support and environment-specific cron triggers.
- Keep the same retention policy and privacy-safe audit/operational event logging.

Completed:
- Extracted retention execution into `services/api-worker/src/ops/retention.ts` so HTTP ops and scheduled execution share one policy.
- Added a Cloudflare `scheduled` handler in the Worker module export.
- Added scheduled retention success/failure operational events.
- Added preview and production cron triggers to `wrangler.toml`.
- Added release contract checks for the scheduled handler and cron configuration.
- Updated Cloudflare deployment docs with cron times and local scheduled test instructions.
- Updated the privacy/security checklist with scheduled retention coverage.

Verification completed:
- `npm run worker:typecheck`
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:dev`
- `git diff --check`

Remaining risks:
- Scheduled retention still needs a live Cloudflare preview deployment test after D1/KV/R2 binding ids are configured.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Expired Export Cleanup Result Record

Plan:
- Re-check the export download path and close the remaining expiry-policy gap.
- Keep authenticated export downloads instead of exposing public R2 object keys.
- Extend ops retention so expired export manifests/assets are deleted from R2 and export records are expired in D1.

Completed:
- Added DB helpers to list expired export manifest/asset keys and mark expired exports.
- Extended `runOpsRetention()` to delete expired R2 export objects before expiring DB records.
- Included matched/deleted/expired export counts in retention responses and audit metadata.
- Passed R2 bindings from both `/api/v1/ops/retention` and the scheduled retention handler.
- Updated Cloudflare deployment docs and the privacy/security checklist with expired export cleanup coverage.

Verification completed:
- `npm run worker:typecheck`
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:dev`
- `git diff --check`

Remaining risks:
- Export download remains authenticated rather than publicly signed; public/shared export links still require a separate token model if they become a product requirement.
- Binary PDF/image rendering is still separate from the current print-ready HTML export asset.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Schedule Move-To-Day UI Result Record

Plan:
- Close the saved-trip editor gap where places could only move to adjacent days.
- Reuse the existing local persistence, route cache invalidation, and Worker `trip_places` update sync path.
- Keep the itinerary table free of raw latitude/longitude details.

Completed:
- Added direct day chips to each saved-place card on the schedule screen.
- Disabled the chip for the place's current day and reused `moveSavedPlace()` for all other day selections.
- Preserved existing previous/next day shortcuts, local `currentTrip` persistence, optimized-route cache clearing, and remote saved-trip sync.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to verify the touch target density and horizontal wrapping on small phones.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Authenticated Profile Display Result Record

Plan:
- Remove launch-inappropriate hardcoded profile identity from the profile screen.
- Reuse the existing authenticated user profile from `AuthProvider`.
- Avoid external sample avatar URLs in the profile header.

Completed:
- Updated the profile screen to display the authenticated user's nickname and email when available.
- Replaced the hardcoded external avatar image with a local initial avatar.
- Updated the profile badge to reflect free/premium entitlement state.
- Reduced profile name sizing and constrained the row so long nicknames do not crowd the badge.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- A real profile image field is still not part of `UserSignupProfile`; Kakao profile image persistence can be added later if product wants user photos.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Kakao Profile Image Persistence Result Record

Plan:
- Preserve Kakao profile image data through the Worker auth boundary and mobile auth profile.
- Store only HTTPS profile image URLs and keep provider secrets server-side.
- Show the real profile image when available, with the existing local initial avatar as fallback.

Completed:
- Added `profile_image` to the Worker D1 users schema and migration set.
- Parsed Kakao `profile_image_url`/`thumbnail_image_url` values from `/v2/user/me`.
- Updated Worker user upsert and public user response to include `profileImage`.
- Added optional `profileImage` to mobile `UserSignupProfile` and persisted it through `AuthProvider`.
- Updated the profile screen to render the profile image when present and fall back to the local initial avatar otherwise.
- Added the new migration to the release contract check.

Verification completed:
- `npm run worker:typecheck`
- `npm run mobile:typecheck`
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:dev`
- `git diff --check`

Remaining risks:
- Existing preview/production D1 databases need migration `0004_user_profile_image.sql` applied before deploying this Worker version.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Export Contract Documentation Alignment Result Record

Plan:
- Align Worker export documentation with the current authenticated download implementation.
- Remove stale "signed public URL" framing from current release docs while keeping public/shared export links as a future product option.
- Add release contract checks for export download security properties.

Completed:
- Updated the API Worker README to describe authenticated print-ready HTML export assets and retention cleanup.
- Updated Cloudflare deployment docs to describe R2 as current share/export asset storage.
- Added migration `0004_user_profile_image.sql` to local D1 migration instructions.
- Updated older export risk notes to point to the later authenticated download and retention implementation.
- Added release contract checks for export download route, ownership lookup, private cache headers, ready download URL response, and print-ready HTML generation.

Verification completed:
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Binary PDF/image rendering remains separate from the current print-ready HTML export asset.
- Public/shared export links still require a separate token model if they become a v1.0 product requirement.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Weather Alternative Replan UI Result Record

Plan:
- Make the premium "weather alternatives" entitlement visible as an actual schedule action.
- Reuse the existing Worker `/planner/replan` path and planner `rainy_backup` style instead of introducing a new weather dependency.
- Keep free users behind a premium gate and log the request as a monetization event.

Completed:
- Added a "비 오는 날 대체코스" action to the schedule replan card.
- Extended schedule replan handling with a weather alternative mode.
- Weather alternative mode uses `rainy_backup` and a 실내/전시/카페/비 오는 날 replacement query to bias provider-backed replacements.
- Preserved existing local persistence, optimized-route cache clearing, remote saved-trip sync, and warning UI.
- Added premium gate copy and ad-event logging for free users requesting weather alternatives.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- This is weather-style replanning, not a live weather forecast integration; live forecast triggers can be added after a weather provider policy is finalized.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Premium IAP Entry Point Result Record

Plan:
- Separate mobile premium purchase/restore orchestration from the profile screen.
- Add a store-platform bridge boundary that can later host Apple/Google IAP SDK calls without changing premium UI.
- Keep the current build honest by returning a clear unavailable state until a native store SDK is connected.

Completed:
- Added `apps/mobile/services/iap.ts` with store platform resolution, premium product id, purchase, restore, and server verification helpers.
- Split profile premium actions into "프리미엄 시작" and "구매 복원".
- Connected restore to the existing authenticated entitlement state API through the new IAP service boundary.
- Preserved the policy that mobile cannot grant itself premium; store verification still goes through the Worker entitlement endpoint.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Live Apple/Google IAP SDK integration is still required before real store purchase and restore flows can submit receipts.
- The current purchase action intentionally reports SDK-unavailable state instead of starting a fake purchase.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Premium Saved Trip Limit Result Record

Plan:
- Make "unlimited trip storage" a real server-side premium benefit, not only UI copy.
- Enforce a free saved-trip limit in the Worker trip creation path.
- Audit both allowed creates and free-limit denials without logging sensitive trip detail.
- Add release contract checks so the storage policy cannot silently disappear.

Completed:
- Added `countActiveTrips()` to the Worker trip DB layer.
- Added `FREE_TRIP_SAVE_LIMIT = 3` to the Worker trip creation route.
- Blocked non-premium users from creating more than 3 active saved trips with stable error code `FREE_TRIP_LIMIT_REACHED`.
- Kept active premium entitlement holders on unlimited saved trips.
- Added audit metadata allowlist keys for the storage policy.
- Added release contract checks for the free limit, entitlement check, denial code, audit record, and active trip count helper.
- Documented the free saved-trip limit in the monetization policy.

Verification completed:
- `npm run worker:typecheck`
- `npm test`
- `npm run check:release-contract`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Mobile `FREE_TRIP_LIMIT_REACHED` handling was later added in the schedule save action; other future save entry points should reuse that helper.
- Active entitlement state still depends on live Apple/Google validation being completed before production purchases can unlock the limit automatically.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Mobile Saved Trip Upsell Result Record

Plan:
- Connect local schedule drafts to the Worker trip save API so users can intentionally persist a generated itinerary.
- Surface the Worker `FREE_TRIP_LIMIT_REACHED` response as a premium storage upsell instead of a generic failure.
- Reuse existing trip place sync so saved drafts keep their current provider-backed places and day assignments.
- Add release contract coverage for the mobile save and free-limit error handling path.

Completed:
- Added mobile API helpers for Worker error code/message extraction and free saved-trip limit detection.
- Added a schedule-screen "서버에 저장" action for local drafts.
- Saved local schedule metadata through `tripsApi.create()` and synced current places through `tripsApi.syncPlaces()`.
- Updated local `currentTrip` storage with the server trip id and returned trip place ids after save.
- Added a free-limit specific premium upsell message for `FREE_TRIP_LIMIT_REACHED`.
- Added release contract checks for the mobile API helper, schedule save action, and free-limit upsell copy.

Verification completed:
- `npm run mobile:typecheck`
- `npm test`
- `npm run check:release-contract`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke with a signed-in free account at the 3-trip limit is still needed to verify the full tap-to-upsell path.
- The save action creates the server trip first and then syncs places; if place sync fails after trip creation, the user may need to retry place sync through existing edit actions.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Worker Free Limit Smoke Result Record

Plan:
- Make the Worker smoke script prove the free saved-trip limit behavior, not only static route contracts.
- Run the limit check before manual premium entitlement activation so the free plan is still active.
- Clean up all smoke-owned trips created for the limit check.
- Document that preview smoke now covers free saved-trip limit denial.

Completed:
- Added a `free saved trip limit` smoke step to `scripts/worker-v1-smoke.mjs`.
- The smoke creates the second and third active trips, then asserts the fourth create returns 403 with `FREE_TRIP_LIMIT_REACHED`.
- Added cleanup for the extra limit setup trips before logout.
- Updated release contract checks to require the smoke limit assertion.
- Updated Cloudflare deployment docs to include free saved-trip limit denial in Worker smoke coverage.

Verification completed:
- `npm test`
- `node --check scripts/worker-v1-smoke.mjs`
- `npm run check:release-contract`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- The smoke script syntax and static contract are verified locally; live execution still requires a running local/preview Worker with D1/KV/R2 bindings.
- If a future smoke step activates premium before this limit check, the free-limit assertion would become invalid; the current ordering keeps it before entitlement activation.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Saved Trip Place Resync Result Record

Plan:
- Close the retry gap after a local draft is saved to the server but place sync fails.
- Reuse the existing schedule save action for saved-trip place resync instead of adding another control.
- Keep local `currentTrip` updated with returned server `tripPlaceId` values after resync.
- Add release contract checks so the saved-trip resync action remains available.

Completed:
- Changed the schedule save action so saved server trips run `syncPlacesToTrip()` instead of returning "already saved".
- Updated the saved-trip button label to "장소 다시 동기화".
- Kept local route point persistence in sync after created/relinked/updated server places are returned.
- Added release contract checks for saved-trip resync behavior and button copy.

Verification completed:
- `npm test`
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to verify the full retry flow after intentionally interrupting place sync.
- Stale remote place pruning was later added to explicit `pruneMissing` sync; per-place delete remains available for targeted removals.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Canonical Place Sync Pruning Result Record

Plan:
- Make schedule resync treat local currentTrip places as the canonical list when explicitly requested.
- Add an opt-in `pruneMissing` flag to Worker place sync so stale remote places are soft-deleted only on intentional full sync.
- Return the pruned count to mobile and surface it in the saved-trip sync notice.
- Extend Worker smoke and release contract checks to cover stale remote place pruning.

Completed:
- Added `pruneMissing` handling to `PATCH /api/v1/trips/:tripId/places/sync`.
- Soft-deleted existing remote places not matched by the incoming sync payload when `pruneMissing: true`.
- Added `sync.pruned` to the Worker response and mobile `TripPlaceSyncResponse`.
- Updated schedule sync calls to pass `pruneMissing: true` and mention pruned remote-only places.
- Added Worker smoke coverage that verifies `pruneMissing` deletes stale remote places.
- Added release contract checks for opt-in pruning and mobile canonical sync behavior.

Verification completed:
- `npm run mobile:typecheck`
- `npm run worker:typecheck`
- `node --check scripts/worker-v1-smoke.mjs`
- `npm test`
- `git diff --check`
- `npm run check:release-contract`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Live Worker smoke with D1 is still required to execute the pruning path against a real database.
- Pruning intentionally depends on local currentTrip being canonical; future multi-device collaboration should use conflict-aware sync instead.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Public Share Page Privacy Headers Result Record

Plan:
- Harden the public `/share/:shareId` HTML page so tokenized itinerary links are not cached, indexed, framed, or leaked through referrers.
- Remove rendered share token fragments from the public footer while keeping the page read-only and coordinate-safe.
- Add static release contracts so public share page privacy headers and token redaction remain enforced.
- Update the privacy/security checklist with the public share page requirement.

Completed:
- Added `cache-control: private, no-store`, `x-robots-tag: noindex, nofollow`, `referrer-policy: no-referrer`, `x-content-type-options: nosniff`, and a restrictive CSP to public share pages.
- Removed the visible share token prefix from the public share page footer.
- Added release contract checks for public share privacy headers, noindex behavior, frame blocking, coordinate copy, and token-fragment redaction.
- Added the public share page privacy item to `docs/privacy-security-checklist.md`.

Verification completed:
- `npm run worker:typecheck`
- `node --check scripts/release-contract-check.mjs`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Live Worker/browser smoke is still needed to inspect response headers from a deployed preview Worker.
- Public share URLs remain bearer links by design; users should treat them as sensitive until an optional password or recipient-scoped sharing model is added.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Public Share API Token Redaction Result Record

Plan:
- Keep owner-only share creation returning the public token because mobile needs it to build share URLs.
- Remove bearer token echoing from unauthenticated public share JSON reads.
- Add no-store/noindex/no-referrer response headers to public share JSON reads.
- Update Worker smoke and static release contracts so public share reads use the generated token but do not return it.

Completed:
- Added public share JSON response headers for cache prevention, indexing prevention, referrer privacy, and content-type hardening.
- Removed `share.token` from `GET /api/v1/share/:shareId` responses.
- Updated Worker smoke to call the public share endpoint with the generated token and assert the response does not echo that bearer token.
- Added release contract checks for public share JSON headers and token redaction.
- Added the public share JSON privacy requirement to `docs/privacy-security-checklist.md`.

Verification completed:
- `npm run worker:typecheck`
- `node --check scripts/worker-v1-smoke.mjs`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Live Worker smoke with D1 is still required to execute the public share token-redaction assertion against a real database.
- Public share URLs remain bearer links; recipient-scoped access or password-protected sharing remains a future privacy hardening option.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Public Share Smoke Header Assertions Result Record

Plan:
- Make live Worker smoke verify public share privacy headers, not only the JSON body.
- Rename the smoke variable from `shareId` to `shareToken` so the public bearer-link model is clear in test code.
- Add release contract checks that keep the public share header assertions in the smoke script.

Completed:
- Added `assertHeaderIncludes()` to `scripts/worker-v1-smoke.mjs`.
- Updated the public share smoke step to assert `cache-control` includes `no-store`.
- Updated the public share smoke step to assert `x-robots-tag` includes `noindex`.
- Updated the public share smoke step to assert `referrer-policy` includes `no-referrer`.
- Added release contract checks for the new public share smoke header assertions.

Verification completed:
- `node --check scripts/worker-v1-smoke.mjs`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Header assertions are syntax/static verified locally; live execution still requires a running local or preview Worker with D1/KV/R2 bindings.
- Public share HTML page headers are contract-checked statically; a browser-level preview smoke remains useful before production.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Search Add Canonical Day Link Result Record

Plan:
- Preserve the Worker-created `trip_days` link when search results are added to an already-saved trip.
- Store returned `dayId`, normalized `dayNumber`, and canonical `sortOrder` in local `currentTrip.routePoints`.
- Keep schedule parsing, serialization, replan, remote sync refresh, and saved-trip hydration aligned with the new local route point shape.
- Add release contract checks to prevent losing canonical `dayId` in mobile flows.

Completed:
- Changed search add-to-trip persistence to keep the full returned `TripPlaceDto` instead of only `tripPlaceId`.
- Stored `dayId`, server `dayNumber`, and server `sortOrder` in local route points after a remote add succeeds.
- Added `dayId` and canonical `sortOrder` to schedule editable trip points, currentTrip serialization, replan preservation, and post-sync refresh.
- Added `dayId` and canonical `sortOrder` preservation to saved-trip hydration from the Worker.
- Added static release contracts for search, schedule, and hydration day-link preservation.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to add a searched place to a saved trip, reopen the schedule, and verify the place remains attached to the intended day.
- The local route point shape now preserves canonical IDs, but future collaborative editing still needs conflict-aware sync.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Canonical Sort Order Refresh Result Record

Plan:
- Keep the mobile schedule's local route point order aligned with Worker-returned `trip_places.sort_order`.
- Preserve canonical sort order when hydrating a saved trip from the Worker.
- Extend static release contracts so schedule sync and hydration cannot drop canonical sort order.

Completed:
- Added `sortOrder` to schedule editable trip point parsing and currentTrip serialization.
- Updated post-sync schedule refresh to store Worker-returned `sortOrder`.
- Updated saved-trip hydration to keep `place.sortOrder` in local route points.
- Added release contract checks for canonical sort order refresh and hydration.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to verify reordered saved trips after app restart.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Search Add Per-Day Sort Order Result Record

Plan:
- Make search add-to-trip calculate `sortOrder` within the selected day instead of using the total route point count.
- Keep local draft ordering aligned with the same per-day order sent to the Worker.
- Add a release contract check so selected-day sort order does not regress.

Completed:
- Added `routePointDayNumber()` and `nextSortOrderForDay()` helpers to the search screen.
- Changed remote add payloads to use selected-day sort order.
- Changed local route point fallback `sortOrder` to use selected-day sort order.
- Added a static release contract for per-day search add sort order.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to add multiple search results across different days and verify each day's order after reopening the schedule.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Schedule Move Delete Sort Sync Result Record

Plan:
- Normalize local per-day `sortOrder` after schedule move/delete actions.
- Move a place to another day without carrying the old day's canonical `dayId`.
- Use the existing bulk sync endpoint to persist normalized day/order state for remaining saved places.
- Keep the final-place delete path compatible with the Worker sync endpoint's non-empty payload requirement.

Completed:
- Sorted saved places in the active-day editor by canonical `sortOrder`.
- Added `normalizeEditablePointSortOrders()` for local move/delete flows.
- Changed move actions to append the moved place to the target day, clear stale `dayId`, normalize per-day order, and bulk sync the result.
- Changed delete actions to normalize remaining local order and bulk sync/prune when places remain, while preserving single-delete behavior for the last place.
- Added release contract checks for move/delete sort normalization, bulk sync, and stale `dayId` removal.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to move and delete saved places across multiple days and verify the reopened schedule/order.
- Bulk sync still runs sequential updates inside the Worker; a true D1 transaction remains a later hardening option.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Rewarded Free Export Boundary Result Record

Plan:
- Align the free export UI copy with actual code so the app does not imply a fake rewarded-ad unlock.
- Add a mobile rewarded export service boundary that can later host AdMob rewarded ads without changing the schedule UI.
- Log privacy-safe ad events for free export attempts while the SDK is not configured.
- Keep export format in ad event metadata so operations can distinguish image and PDF free-export requests.

Completed:
- Added `apps/mobile/services/rewardedAds.ts` with `requestRewardedExportUnlock()`.
- Changed free image/PDF export gates to call the rewarded export boundary with the requested format.
- Logged `requested` and `failed` ad events with `reason=sdk_not_configured` until an actual rewarded-ad SDK is connected.
- Updated schedule export copy to say free export activates after rewarded-ad SDK integration.
- Added `format` to Worker ad metadata allowlist.
- Updated monetization policy and release contracts for the rewarded free export boundary.

Verification completed:
- `npm run mobile:typecheck`
- `npm run worker:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- A real AdMob rewarded-ad SDK integration is still required before free users can actually earn a one-time export.
- Device-level smoke is still needed after SDK integration to verify ad load/show/earned/dismissed events.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Logout Local Privacy Cleanup Result Record

Plan:
- Prevent account-switch data exposure by clearing local trip drafts and optimized route cache on logout.
- Reuse the same local cleanup path for logout, account deletion, and invalid-session cleanup.
- Update user-facing logout copy so users know local temporary itinerary data is removed.
- Add release contract checks for the mobile logout privacy cleanup path.

Completed:
- Added `clearLocalAuthState()` to centralize local auth/profile/trip/route cleanup in the mobile auth provider.
- Updated `logout()` to clear SecureStore tokens, user profile, local `currentTrip`, and cached `optimizedRoute`.
- Updated invalid-session cleanup to use the same local cleanup path.
- Kept account deletion on the same cleanup path after the Worker-side deletion succeeds.
- Updated profile logout confirmation copy and the privacy/security checklist.
- Added release contract checks for mobile auth cleanup and local trip draft deletion.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to confirm logout clears schedule/search/route state before another account logs in on the same device.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Deleted Trip Local Draft Cleanup Result Record

Plan:
- Prevent deleted saved trips from remaining open as local `currentTrip` data on the same device.
- Clear the cached optimized route only when the deleted trip matches the currently open local trip.
- Keep unrelated local drafts untouched when another saved trip is deleted from the profile list.
- Add release contract checks and privacy checklist coverage for targeted trip deletion cleanup.

Completed:
- Added `clearLocalTripDraftDataForTrip()` to parse the stored `currentTrip` and clear local draft data only when the ids match.
- Updated the profile trip deletion flow to call targeted local cleanup after the Worker delete succeeds.
- Updated the deletion confirmation and success copy to explain that an open local itinerary can be cleared.
- Added release contract checks for targeted local cleanup and profile deletion usage.
- Updated the privacy/security checklist with saved-trip deletion local cleanup.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to delete the currently open saved trip and confirm the schedule/search/route screens return to safe empty states.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Deleted Trip Cleanup Failure Boundary Result Record

Plan:
- Keep remote saved-trip deletion and same-device local draft cleanup as separate failure boundaries.
- Ensure a local AsyncStorage/cache cleanup failure does not make the UI report that the remote trip deletion failed.
- Show a recovery-oriented message when only local cleanup fails.
- Add release contract coverage for the separated cleanup status.

Completed:
- Added a `localCleanupStatus` branch in the profile trip deletion flow after the Worker delete succeeds.
- Kept the saved trip removed from the local profile list even if same-device draft cleanup fails.
- Added user copy that distinguishes "remote trip deleted, local open itinerary cleanup failed" from a true delete failure.
- Extended release contract checks for the separated local cleanup failure boundary.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to force AsyncStorage cleanup failure or simulate it in development and verify the exact user-facing notice.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Expired Session Local Cleanup Boundary Result Record

Plan:
- Share the mobile local auth cleanup path across AuthProvider and the API interceptor.
- Clear auth tokens, stored user profile, local `currentTrip`, and cached optimized routes when refresh cannot recover a 401 response.
- Avoid leaving a logged-out device with stale profile or itinerary data after token expiry.
- Add release contract and privacy checklist coverage for API-interceptor cleanup.

Completed:
- Added `apps/mobile/services/authCleanup.ts` with exported `clearLocalAuthState()`.
- Updated AuthProvider logout, account deletion, and bootstrap invalid-session cleanup to use the shared cleanup service.
- Updated the API interceptor to call the same cleanup service when no refresh token exists or refresh fails.
- Added release contract checks for the shared cleanup service and API-interceptor cleanup usage.
- Updated the privacy/security checklist with expired-session local cleanup coverage.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to expire/rotate tokens and confirm app navigation/state resets cleanly after interceptor cleanup.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Expired Session Auth State Sync Result Record

Plan:
- Notify AuthProvider when shared local auth cleanup is triggered outside AuthProvider.
- Preserve reasoned cleanup paths for logout, account deletion, invalid session, and expired session.
- Ensure API interceptor refresh failure updates React auth state to `unauthenticated` without waiting for app restart.
- Add release contract coverage for the cleanup event subscription.

Completed:
- Added `LocalAuthClearReason`, listener registration, and cleanup notification to `authCleanup`.
- Updated AuthProvider to subscribe to local auth cleanup events and clear in-memory user/status state.
- Added reasoned cleanup calls for logout, account deletion, invalid-session bootstrap failure, and API interceptor expired-session failures.
- Extended release contract checks for cleanup events, AuthProvider subscription, and reasoned cleanup calls.
- Updated the privacy/security checklist with expired-session AuthProvider state sync.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to force a refresh failure and confirm navigation surfaces react immediately to unauthenticated state.
- The cleanup listener is in-memory only; if cleanup occurs before AuthProvider mounts, bootstrap still handles persisted state on next mount.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Local Trip Draft Cleanup Screen Sync Result Record

Plan:
- Notify mounted mobile screens when local `currentTrip` and optimized-route cache are cleared.
- Reset schedule, route-map, and search day-selection state so deleted or expired-session trips do not remain visible in memory.
- Make route-map ignore stale route-point URL params after local trip draft cleanup.
- Add release contract coverage for the screen subscriptions.

Completed:
- Added `subscribeLocalTripDraftDataCleared()` and clear reasons to `localTripStorage`.
- Updated auth cleanup to pass its cleanup reason into local trip draft cleanup.
- Updated schedule screen to clear route, editable places, trip draft, metadata, and active day when local draft cleanup fires.
- Updated route-map screen to clear route state and ignore stale URL params after local draft cleanup.
- Updated search screen to reset date/day selection after local draft cleanup.
- Extended release contract checks and the privacy/security checklist for mounted-screen stale-state cleanup.

Verification completed:
- `npm run mobile:typecheck`
- `npm run check:release-contract`
- `npm test`
- `git diff --check`
- `npm run check:health`
- `npm run check:dev`

Remaining risks:
- Device-level smoke is still needed to delete an open trip or expire a session while schedule/route-map/search are mounted and confirm each screen switches to a safe empty state.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Mobile Env Public-Key Gate Result Record

Plan:
- Strengthen `check:env` so every key in `apps/mobile/.env` must be explicitly public.
- Add missing server-only route provider secret coverage for `ODSAY_API_KEY`.
- Align the mobile `.env.example` with the public affiliate URL variables used by the app.
- Add release contract and env documentation coverage for the stricter mobile env boundary.

Completed:
- Updated `scripts/dev-readiness-check.mjs` to reject any mobile env key that does not start with `EXPO_PUBLIC_`.
- Added `ODSAY_API_KEY` to the mobile server-only forbidden list.
- Added public affiliate URL keys to `apps/mobile/.env.example`.
- Extended release contract checks to require the stricter mobile env gate and public affiliate examples.
- Updated `docs/env.md` with the mobile public-key-only rule.

Verification completed:
- `npm run check:env`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- Existing local untracked `apps/mobile/.env` files on developer machines must be corrected before `npm run check:env` can pass.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Kakao Web Map Public Key Boundary Result Record

Plan:
- Document the existing `EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY` usage for web Kakao map rendering.
- Keep Kakao's public JavaScript key distinct from the server-only `KAKAO_REST_API_KEY`.
- Warn when `EXPO_PUBLIC_MAP_PROVIDER=kakao` is selected without the public JavaScript map key.
- Add release contract coverage for the public key example and readiness warning.

Completed:
- Added `EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY` to `apps/mobile/.env.example`.
- Added a `check:env` warning when Kakao map provider is selected without the public web map key.
- Extended release contract checks to require the public Kakao JavaScript key example and readiness warning.
- Updated `docs/env.md` to describe the domain-restricted public JavaScript key and keep `KAKAO_REST_API_KEY` server-only.

Verification completed:
- `npm run check:env`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- Actual Kakao web map rendering still needs a domain-restricted Kakao JavaScript key configured in the deployed environment.
- Native Naver/Kakao SDK integration remains a separate device/EAS validation item.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Worker Wrangler Secret Vars Gate Result Record

Plan:
- Prevent provider/JWT/IAP/admin secrets from being committed into `wrangler.toml` vars.
- Keep `wrangler.toml` vars limited to non-secret runtime configuration.
- Extend release contract checks so the secret-in-vars guard cannot be removed silently.
- Update env documentation with the Worker vars vs Cloudflare secrets boundary.

Completed:
- Added `extractTomlVarsBlocks()` to `scripts/dev-readiness-check.mjs`.
- Added a server-only Worker secret key list and made `check:env` fail when those keys appear in `[vars]` or `[env.*.vars]`.
- Extended release contract checks for the Worker secret-in-vars guard.
- Updated `docs/env.md` to require `wrangler secret put` for provider keys, JWT secrets, admin token, and purchase verification secrets.

Verification completed:
- `npm run check:env`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- `check:env` cannot verify that Cloudflare secrets actually exist remotely; preview/production deploy still needs `wrangler secret list` or deployment smoke with configured secrets.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## Mobile Env Variant Scan Result Record

Plan:
- Extend mobile env validation beyond `apps/mobile/.env`.
- Scan Expo runtime env variants such as `.env.local`, `.env.development`, and `.env.production`.
- Keep `.env.example` as documentation-only and excluded from runtime secret failure checks.
- Add release contract and env documentation coverage for the expanded scan.

Completed:
- Added `listMobileRuntimeEnvFiles()` to `scripts/dev-readiness-check.mjs`.
- Added `checkMobileEnvFile()` and applied the public-key/server-only checks to every runtime `apps/mobile/.env*` file except `.env.example`.
- Updated release contract checks to require all mobile runtime env variants to be scanned.
- Updated `docs/env.md` to document the expanded mobile env scan boundary.

Verification completed:
- `npm run check:env`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- `check:env` only scans env files under `apps/mobile`; CI and app-store build systems must still keep secrets out of external build profile configuration.
- `npm run check:dev` still warns that local env files are missing and Cloudflare binding ids remain placeholders until preview/production setup.

## EAS Build Env Boundary Result Record

Plan:
- Add explicit EAS build profiles for mobile development, preview, and production.
- Keep EAS build profile env values public-only with `EXPO_PUBLIC_*` keys.
- Make `check:env` scan EAS `env` objects for server-only keys and non-public names.
- Fail preview/production checks when EAS API base URLs still point to localhost, placeholder, or example domains.

Completed:
- Added `apps/mobile/eas.json` with development, preview, and production build profiles.
- Added `collectEasEnvObjects()` and `checkMobilePublicEnvMap()` to `scripts/dev-readiness-check.mjs`.
- Extended `check:env` to reject non-`EXPO_PUBLIC_` or server-only keys in EAS build env blocks.
- Extended preview/production checks to require real EAS `EXPO_PUBLIC_API_BASE_URL` values.
- Updated release contract checks and env documentation for the EAS mobile env boundary.

Verification completed:
- `npm run check:env`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- EAS preview/production API base URLs are intentionally placeholders until real Cloudflare Worker domains are assigned, so `npm run check:env:preview` and `npm run check:env:production` should fail before deployment setup.
- EAS remote secret storage and native SDK keys still require direct console/CI review before store submission.

## CI Env Readiness Gate Result Record

Plan:
- Run the strengthened env/security readiness check in the GitHub v1 release gate.
- Ensure mobile env, EAS env, and Worker wrangler secret boundary regressions fail in CI, not only locally.
- Extend release contract checks so the CI env step cannot be removed silently.

Completed:
- Added an `Environment readiness` step to `.github/workflows/tripmate-v1-gate.yml`.
- The CI gate now runs `npm run check:env` before release contract, tests, and build/typecheck health checks.
- Updated `scripts/release-contract-check.mjs` to require the CI `npm run check:env` step.

Verification completed:
- `npm run check:env`
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- CI uses local target checks by default; preview/production placeholder failures still require explicit `check:env:preview` and `check:env:production` before deployment.
- Live GitHub Actions execution remains to be observed after pushing this commit.

## Preview Production Kakao Web Key Gate Result Record

Plan:
- Keep local development permissive with warnings for missing Kakao web map public key.
- Fail preview/production env checks when Kakao map provider is selected without `EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY`.
- Preserve the separation between public Kakao JavaScript key and server-only Kakao REST key.
- Add release contract and env documentation coverage for the stricter deploy target gate.

Completed:
- Updated `scripts/dev-readiness-check.mjs` so `check:env:preview` and `check:env:production` fail when EAS Kakao provider lacks `EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY`.
- Kept local `check:env` behavior as warnings so local development remains usable before real deploy keys are assigned.
- Extended release contract checks for the preview/production Kakao web key error.
- Updated `docs/env.md` with the deploy-target Kakao public key requirement.

Verification completed:
- `npm run check:env`
- `npm run check:release-contract`
- `npm test`
- `npm run check:env:preview` failed as expected with EAS preview Worker URL, Kakao public key, D1, and KV placeholder errors.
- `npm run check:health`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- Real domain-restricted Kakao JavaScript keys still need to be created and configured in EAS/hosting environments before preview or production release.
- `check:env:preview` and `check:env:production` still intentionally fail while EAS Worker URLs and Cloudflare binding IDs are placeholders.

## Mobile Location Permission Boundary Result Record

Plan:
- Remove unused iOS Always location permission copy from the Expo app config.
- Keep TripMate v1.0 scoped to foreground location access unless a reviewed background-location feature is implemented.
- Add release contract checks so background/Always location permission requests cannot return silently.
- Update the privacy/security checklist with the location permission boundary.

Completed:
- Removed `NSLocationAlwaysUsageDescription` from `apps/mobile/app.json`.
- Updated `NSLocationWhenInUseUsageDescription` to describe foreground nearby-place and route-context usage.
- Added `scripts/release-contract-check.mjs` assertions for required iOS When-In-Use copy and forbidden iOS/Android background location permissions.
- Added the background/Always location boundary to `docs/privacy-security-checklist.md`.

Verification completed:
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:env`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- App Store and Play Store console privacy nutrition/data safety answers still require manual review before submission.
- Device-level permission prompt copy should be checked on a real Expo/EAS build after native config regeneration.

## Store Entitlement Pending Contract Result Record

Plan:
- Strengthen the monetization boundary so store-platform entitlement requests cannot unlock premium before live Apple/Google validation exists.
- Keep manual entitlement activation restricted to non-production smoke/operations use.
- Add Worker smoke assertions for both manual non-production activation and store-platform pending behavior.
- Add release contract checks and policy documentation so this boundary cannot regress silently.

Completed:
- Added Worker smoke assertions that manual entitlement activation reports `manual-non-production` and premium true only in the non-production smoke path.
- Added Worker smoke assertions that an Apple-style store entitlement request with requested `active` status remains `pending` and does not unlock premium.
- Added release contract checks for production manual entitlement blocking, non-production manual verification mode, live store validation pending behavior, and smoke coverage.
- Updated the monetization policy to state that submitted Apple/Google receipts or transaction ids must remain pending until live validation confirms them.

Verification completed:
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:env`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- Live Apple App Store Server API and Google Play Developer API validation still need real SDK/server integration before production premium purchases can be enabled.
- Worker smoke remains intentionally limited to local/preview because it creates and deletes smoke-owned data.

## Mobile Share URL Privacy Fallback Result Record

Plan:
- Remove web fallback copy that rendered full bearer-style public share URLs when Clipboard API was unavailable.
- Keep the successful clipboard/native share paths unchanged.
- Add release contract checks so schedule/profile share notices cannot regress to rendering share URLs.
- Update the privacy/security checklist with mobile share fallback coverage.

Completed:
- Updated schedule share fallback copy to avoid displaying the generated public share URL when clipboard access is unavailable.
- Updated profile saved-trip share fallback copy with the same non-token user notice.
- Added release contract checks for schedule/profile fallback copy and the removed URL-rendering phrase.
- Added checklist coverage for mobile share fallback copy.

Verification completed:
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:env`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- Web users without Clipboard API support must retry after enabling clipboard permission or use a supported browser; this avoids exposing bearer links in persistent UI notices.
- Device/browser smoke is still needed for native share sheet and web clipboard permission-denied behavior.

## Cloudflare Deployment Endpoint Scope Doc Result Record

Plan:
- Re-check the deployment documentation against the implemented Worker trip-day and trip-place mutation routes.
- Remove stale wording that still described those routes as placeholder release blockers.
- Add release contract checks so deployment docs keep reflecting the current Worker endpoint scope.

Completed:
- Updated `docs/deployment-cloudflare.md` Required Endpoints to include auth, trip-day mutations, trip-place mutations, export preparation/downloads, monetization, and operations endpoints.
- Removed stale placeholder wording about incomplete trip-day and trip-place mutation endpoints.
- Added release contract checks that fail if the stale placeholder wording returns or current endpoint scope terms disappear.

Verification completed:
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:env`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- Preview/production deployment still requires real Cloudflare binding IDs, Worker domains, secrets, and live smoke evidence.
- Historical phase notes may still mention earlier placeholder states; the canonical deployment document now reflects the current implementation.

## Guest Profile Token Boundary Result Record

Plan:
- Remove the profile setup path that minted local `signup_*` auth/access/refresh tokens.
- Preserve guest-mode onboarding by saving profile preferences without marking the user authenticated.
- Keep Kakao login as the only current authenticated mobile login path.
- Add release contract and privacy checklist coverage so fake signup tokens cannot return silently.

Completed:
- Added `saveGuestProfile()` to the mobile AuthProvider for token-free guest profile persistence.
- Updated auth bootstrap to load stored guest profiles while keeping `status` as `unauthenticated` when no server tokens exist.
- Changed profile setup completion to call `saveGuestProfile(userData)` instead of `setSession()` with generated local tokens.
- Added release contract checks that reject `signup_auth_`, `signup_access_`, `signup_refresh_`, and `setSession({` in profile setup.
- Added privacy checklist coverage for guest profile setup not minting local tokens.

Verification completed:
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:env`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- Email/password account creation remains a product/UI placeholder; current authenticated release path is Kakao login.
- Guest profile preferences are local to the device until the user logs in and the profile is merged through Kakao login.

## Guest Auth UI Password Collection Result Record

Plan:
- Remove unsupported email/password login UI from the login screen.
- Remove password and password confirmation collection from the guest profile setup entry screen.
- Reposition the former signup route as guest profile setup until a real email authentication backend exists.
- Add release contract and privacy checklist coverage so password collection cannot return silently before backend support exists.

Completed:
- Updated the login screen to show Kakao login, "로그인 없이 둘러보기", and a guest profile setup link instead of email/password login.
- Updated the signup route copy to "게스트 프로필 만들기" and removed password/password confirmation state, validation, and input fields.
- Kept guest profile setup collecting only email/nickname preferences before the multi-step preference flow.
- Added release contract checks that reject password field copy/props in login and guest profile screens.
- Added privacy checklist coverage for not collecting passwords without an email authentication backend.

Verification completed:
- `npm run check:release-contract`
- `npm test`
- `npm run check:health`
- `npm run check:env`
- `git diff --check`
- `npm run check:dev`

Remaining risks:
- A real email/password account system would require Worker endpoints, password hashing policy, reset flows, abuse prevention, and store/privacy copy before reintroducing password fields.
- Device-level smoke should confirm the guest start, guest profile setup, and Kakao login paths route as expected.
