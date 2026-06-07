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

Rewarded free export is prepared as a mobile service boundary. Until an AdMob rewarded-ad SDK is connected, free export requests must log `requested` and `failed` ad events with `reason=sdk_not_configured` and must not fake an earned reward or unlock premium export.

## Premium

Premium unlocks:

- ads removed
- unlimited trip storage
- PDF/image export
- advanced itinerary regeneration
- weather-based alternative plans
- collaboration-ready features

Free users can keep up to 3 active saved trips. The limit is enforced by the Worker `POST /api/v1/trips` route using server-side active entitlement state; the mobile client must only present the plan state and cannot override the storage policy.

Digital premium purchases must use Apple IAP or Google Play Billing. The Worker endpoint `/api/v1/monetization/entitlements/verify` stores entitlement state and is ready for store validation integration. Do not route digital premium purchases through an external PG inside the mobile app.

The mobile client must not decide premium status by itself. Apple/Google verification requests may submit a store receipt or transaction id to the Worker, but the Worker stores only a hash and returns `pending` until live store validation is implemented. Manual active entitlements are allowed only outside production for operations/testing.

Production must not treat a submitted Apple/Google receipt, transaction id, or requested `active` status as premium until live store validation confirms it. Until that integration exists, store-platform verification responses must remain `pending` and must not unlock premium benefits.

Entitlement verification responses must keep two states separate: `canUnlockPremium` reflects the persisted active entitlement state, while `verificationRequired` tells the client whether Apple/Google store validation is still required. The mobile app should show reason-specific pending copy for `missing_store_receipt`, `store_validation_secret_missing`, and `live_store_validation_not_yet_implemented` instead of implying that a submitted receipt has activated premium.

## Affiliate Links

Allowed affiliate categories:

- hotel
- rental car
- ticket
- insurance
- local tour

External bookings are physical or third-party services and must remain separate from app digital premium purchases. The API records affiliate clicks with a hashed target URL, not the raw target URL.

Mobile affiliate buttons must use public HTTPS URL environment variables. Do not hardcode partner links in code. If a link is not configured, the UI may show the placement as "링크 설정 필요" but must not fake a booking destination.

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
