# Monetization Policy

TripMate v1.0 monetization is structured around ads, premium entitlements, affiliate links, and clearly disclosed sponsored places.

## Ads

Allowed ad placements:

- itinerary generated result
- share completed result
- free export result
- schedule bottom
- map bottom

Ads must not interrupt itinerary generation. The app can log ad events with `/api/v1/monetization/ad-events`.

## Premium

Premium unlocks:

- ads removed
- unlimited trip storage
- PDF/image export
- advanced itinerary regeneration
- weather-based alternative plans
- collaboration-ready features

Digital premium purchases must use Apple IAP or Google Play Billing. The Worker endpoint `/api/v1/monetization/entitlements/verify` stores entitlement state and is ready for store validation integration. Do not route digital premium purchases through an external PG inside the mobile app.

## Affiliate Links

Allowed affiliate categories:

- hotel
- rental car
- ticket
- insurance
- local tour

External bookings are physical or third-party services and must remain separate from app digital premium purchases. The API records affiliate clicks with a hashed target URL, not the raw target URL.

## Sponsored Places

Sponsored places must show "광고" or "스폰서" in the UI. Sponsored content must not be made to look like organic ranking.

## Logging Rules

Do not log:

- access tokens
- refresh tokens
- provider secrets
- raw purchase receipts
- raw affiliate target URLs
- detailed user location history

Ad metadata is allowlisted by key before persistence.
