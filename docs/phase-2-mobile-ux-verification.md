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

## Verification

Passed:

1. `npm --prefix apps/mobile run typecheck -- --pretty false`
2. `npm --prefix packages/planner run build`
3. `git diff --check`
4. Static scan found no `as any`, `@ts-ignore`, or `@ts-expect-error` under the touched app/components/services scope.
5. Static scan found no hardcoded secret-shaped values in the mobile app, planner package, or docs touched for this phase.
6. Static scan found no user-facing raw `위도`/`경도` copy or `selectedCoord` display under the touched app/components/services scope. Native map coordinate objects still exist where required for map rendering.

Attempted manual surface checks:

1. `expo start --web --port 8081 --non-interactive --localhost`
2. `expo export --platform web --output-dir dist`

Observed blocker:

1. `expo start --web` hangs without opening a port, both inside sandbox and with escalated execution.
2. `expo export --platform web` fails before app code renders:
   `Invalid call at line 2: process.env.EXPO_ROUTER_APP_ROOT`
3. The failing module is `apps/mobile/node_modules/expo-router/_ctx.web.js`.

## Residual Risks

1. Owner: Engineering
2. Due: before Phase 2 can be called fully manually verified
3. Required next action: repair the Expo Router / Metro web context transform or validate the same flow on a simulator/native Expo surface.
4. This blocker prevents the manual web smoke flow from proving region -> dates -> style -> draft behavior in a browser.
