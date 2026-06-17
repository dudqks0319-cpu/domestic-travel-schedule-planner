# Phase 2 Mobile UX Verification

Date: 2026-06-17
Branch: `agent/tripmate-v1-release-goal`

## Completed Scope

1. Home is now map-first with region markers before image recommendation cards.
2. Trip creation is reduced from seven blocking steps to four steps:
   - region and style
   - dates
   - optional trip settings
   - optional place preferences
3. Region and date are the only hard requirements for draft generation.
4. Map provider state is separated from mock preview state.
5. `currentTrip` route points are parsed through a production guard:
   - provider/manual route points can render normally
   - mock route points are marked as mock
   - production runtime does not invent mock route points unless explicitly enabled
6. Schedule and map screens no longer show raw latitude/longitude as itinerary copy.
7. Search now separates first-run, empty, loading, provider-error, and retry states.
8. Existing `as any` suppressions in the touched mobile flow were removed.
9. Expo web QA surface now exports successfully after explicitly enabling the Expo Router Babel plugin and pinning Metro runtime React resolution to the workspace React package.

## Verification

Passed:

1. `npm --prefix apps/mobile run typecheck -- --pretty false`
2. `npm --prefix packages/planner run build`
3. `git diff --check`
4. Static scan found no `as any`, `@ts-ignore`, or `@ts-expect-error` under the touched app/components/services scope.
5. Static scan found no hardcoded secret-shaped values in the mobile app, planner package, or docs touched for this phase.
6. Static scan found no user-facing raw `위도`/`경도` copy or `selectedCoord` display under the touched app/components/services scope. Native map coordinate objects still exist where required for map rendering.
7. `npx expo export --platform web --output-dir dist-qa-direct --clear`

Manual surface checks:

1. Served `apps/mobile/dist-qa-direct` through a local SPA fallback server.
2. Opened `http://127.0.0.1:4175/trip/create?destination=서울&styleKey=healing_trip` at 390px mobile viewport.
3. Verified step 1 renders the prefilled Seoul + `바다+카페+맛집` flow.
4. Verified step 2 date picker opens, blocks past dates, accepts `2026-06-18` to `2026-06-20`, and calculates `2박 3일`.
5. Verified step 3 accepts trip settings: `혼자`, `대중교통`, `호텔`.
6. Verified step 4 renders the preference surface and calls the local API backend.

Screenshots:

1. `/Users/jyb-m3max/Desktop/codex/tripmate-home-mobile.png`
2. `/Users/jyb-m3max/Desktop/codex/tripmate-create-step1-390.png`
3. `/Users/jyb-m3max/Desktop/codex/tripmate-create-step2-390.png`
4. `/Users/jyb-m3max/Desktop/codex/tripmate-create-step4-api-placeholder-390.png`

Resolved web blocker:

1. Previous blocker: `expo export --platform web` failed before app code rendered with:
   `Invalid call at line 2: process.env.EXPO_ROUTER_APP_ROOT`
2. Root cause: `babel-preset-expo` was resolved from the workspace root, while `expo-router` lived under `apps/mobile/node_modules`, so the preset did not auto-apply the Expo Router Babel transform.
3. Fix: `apps/mobile/babel.config.js` now explicitly includes `expoRouterBabelPlugin`.
4. Follow-up issue: Metro then resolved runtime `react` through TypeScript's React type path mapping.
5. Fix: `apps/mobile/metro.config.js` now routes runtime `react` and `react/*` imports to the workspace React package while leaving TypeScript type resolution intact.

Observed external-provider limit:

1. With `services/api` running on `127.0.0.1:4000`, step 4 requests reached the API backend.
2. The backend returned upstream `401` failures for tourism and restaurant lookups because the QA run used placeholder `DATA_GO_KR_API_KEY` and no real Naver provider credentials.
3. This confirms the local UI-to-backend path, but not live provider data rendering.

## Residual Risks

1. Owner: Engineering
2. Due: Phase 3 provider integration QA
3. Required next action: run the same step 4 smoke with real server-side `DATA_GO_KR_API_KEY`, `NAVER_CLIENT_ID`, and `NAVER_CLIENT_SECRET` configured outside the mobile bundle.
4. Remaining manual gap: final AI itinerary generation cannot be called fully verified until live provider data is available or a deliberate local fixture mode is added.
