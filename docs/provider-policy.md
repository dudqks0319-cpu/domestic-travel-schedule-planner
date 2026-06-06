# Provider Policy

TripMate uses provider data to build travel schedules. Provider failures must be visible to the app as warnings or empty states; they must not be hidden behind fake production places.

## Priority

1. Naver place/local search
2. Kakao local search
3. Tour API keyword/tourism/festival data
4. KV/cache result
5. Empty state with retry action

## Server-Only Rule

Provider API calls happen through `services/api-worker`. Mobile code can choose a display provider with `EXPO_PUBLIC_MAP_PROVIDER`, but it must never contain provider secrets.

## Normalization

All provider adapters return `NormalizedPlace` with:

- stable provider id
- display name and category
- address or road address when available
- latitude and longitude for map rendering only
- tags and score
- explicit `isSponsored` and `sponsorLabel`

Provider raw responses should not be stored indefinitely. Cache only normalized and privacy-safe fields.

Address geocoding and reverse geocoding are server-side provider calls. The Worker tries Naver Cloud Maps geocoding/reverse geocoding first, falls back to Kakao Local API when Naver is unavailable, caches normalized results in KV, and returns warnings instead of exposing provider failures as app crashes.

All external provider HTTP calls must use the shared Worker provider fetch helper with a bounded timeout. Slow or failed providers should produce warnings and fallback/empty results rather than blocking the full search or itinerary flow.

Driving route optimization is server-side. When Naver Cloud Maps credentials are configured and the request mode is `driving`, the Worker calls Naver Directions 5 first and normalizes the result as a `naver` route. If Naver is unavailable or returns no route, the Worker tries Kakao Mobility directions and normalizes the result as a `kakao` route. If both providers fail, the response falls back to a clearly labeled expected movement-time route. Naver, Kakao, and fallback route cache keys are separated so an old fallback cache entry cannot hide a recovered provider route.

Planner generate/replan responses also use provider directions when available. The pure planner package remains a fallback schedule engine, while the Worker enriches day-level `routeToNext` segments and `routeSummary` with Naver or Kakao driving route data before returning the response. If provider enrichment fails, the Worker keeps fallback movement times and returns recoverable provider warnings.

## Cache TTL

- place search: 1 to 7 days depending on provider and query stability
- route summaries: 6 hours in D1 `route_cache`
- festivals/events: expire based on event date

## Rate Limits

Provider and cost-sensitive Worker endpoints must be rate limited before they call external APIs or create export assets. Current KV-backed limits are:

- `GET /api/v1/places/search`: 60 requests per minute
- `GET /api/v1/places/geocode`: 60 requests per minute
- `GET /api/v1/places/reverse-geocode`: 60 requests per minute
- `POST /api/v1/planner/generate`: 20 requests per minute
- `POST /api/v1/routes/optimize`: 30 requests per minute
- `POST /api/v1/trips/:tripId/exports`: 20 requests per hour

Authenticated requests are limited by user id. Guest/public requests are limited by Cloudflare client IP or forwarded IP. Responses include `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset`.

## Production Fallback

Production must not display synthetic coordinates as real provider places. If all providers fail, return an empty result with warnings and show a retry/empty UI.

Fallback route summaries are allowed only when they are calculated from real user-selected or provider-returned coordinates, and the UI must label them as expected or fallback movement time.

## Sponsored Content

Sponsored places can appear only when:

- `isSponsored` is true
- `sponsorLabel` or disclosure text is shown in UI
- ranking does not hide the sponsored nature of the recommendation

The Worker applies active D1 `sponsored_places` campaigns to provider search results before persisting or returning `provider_places`. Matching can use `provider_place_id` or normalized place name. Sponsored matches must keep the same place data but set `isSponsored=true`, apply the explicit disclosure label, and record `sponsoredCount` in operational metadata.

Sponsored campaigns are managed through the server-only `/api/v1/ops/sponsored-places` endpoints protected by `OPS_ADMIN_TOKEN`. Mobile clients must never call these operations endpoints or receive the operations token.
