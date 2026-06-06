# TripMate Cloudflare Workers MVP Plan

## Decision

TripMate should move toward Cloudflare Workers Paid + D1 + KV + R2 for the monetized MVP, but the current `services/api` Express + Prisma + SQLite service should stay intact until the Worker API reaches feature parity.

The migration path is additive:

1. Keep `services/api` as the local/reference API.
2. Add `services/api-worker` as the Cloudflare runtime boundary.
3. Move provider adapters first, then trip/planner persistence.
4. Switch the mobile `EXPO_PUBLIC_API_BASE_URL` only after preview verification.

## Target Worker Structure

```text
services/
  api-worker/
    src/
      index.ts
      routes/
        health.ts
        places.ts
        planner.ts
        routes.ts
        trips.ts
        monetization.ts
      adapters/
        naver.ts
        kakao.ts
        tour.ts
      db/
        schema.sql
        queries.ts
```

## Provider Contract

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

## D1 Tables

Initial D1 migration should cover:

- `users`
- `trips`
- `trip_days`
- `trip_places`
- `provider_places`
- `route_cache`
- `share_links`
- `subscription_entitlements`
- `ad_events`
- `affiliate_clicks`

## Wrangler Draft

```toml
name = "tripmate-api"
main = "services/api-worker/src/index.ts"
compatibility_date = "2026-06-01"

[vars]
ENVIRONMENT = "production"
API_VERSION = "v1"

[[d1_databases]]
binding = "DB"
database_name = "tripmate-prod"
database_id = "REPLACE_WITH_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "PLACE_CACHE"
id = "REPLACE_WITH_KV_NAMESPACE_ID"

[[r2_buckets]]
binding = "TRIPMATE_ASSETS"
bucket_name = "tripmate-assets"
```

## Required Secrets

Set these with `wrangler secret put` in each environment:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `DATA_GO_KR_API_KEY`
- `APPLE_SHARED_SECRET`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

## Migration Risks

1. Prisma nested create/include/transaction behavior must be replaced with explicit D1 queries.
2. `jsonwebtoken`, `dotenv`, `axios`, and Node process env usage should not leak into Worker code.
3. Provider responses should be cached and normalized before they reach mobile.
4. Production must not present synthetic coordinates as real recommendations.
5. Write APIs must require authentication and trip ownership checks.
