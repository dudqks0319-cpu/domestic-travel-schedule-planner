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

## Cache TTL

- place search: 1 to 7 days depending on provider and query stability
- route summaries: 1 to 24 hours
- festivals/events: expire based on event date

## Production Fallback

Production must not display synthetic coordinates as real provider places. If all providers fail, return an empty result with warnings and show a retry/empty UI.

Fallback route summaries are allowed only when they are calculated from real user-selected or provider-returned coordinates, and the UI must label them as expected or fallback movement time.

## Sponsored Content

Sponsored places can appear only when:

- `isSponsored` is true
- `sponsorLabel` or disclosure text is shown in UI
- ranking does not hide the sponsored nature of the recommendation
