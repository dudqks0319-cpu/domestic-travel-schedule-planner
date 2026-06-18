# TripMate Monetization Policy

Date: 2026-06-17
Scope: Worker monetization scaffolding for ads, affiliate clicks, and premium entitlement state.

## Current Implementation

The Worker implements these authenticated endpoints:

1. `POST /api/v1/monetization/ad-events`
2. `POST /api/v1/monetization/affiliate-clicks`
3. `POST /api/v1/monetization/entitlements/verify`
4. `GET /api/v1/monetization/entitlements/me`

The entitlement verify endpoint performs server-side store verification when configured:

1. Apple receipts are posted to App Store receipt validation using `APPLE_SHARED_SECRET`.
2. Google Play purchase tokens are checked through the Android Publisher API using `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` and `GOOGLE_PLAY_PACKAGE_NAME`.
3. Unconfigured or transient verification stores `pending_verification` and does not unlock premium.
4. Store-rejected purchases store `verification_failed` and do not unlock premium.
5. Only server-verified purchases store `active`.

The mobile profile screen reads `GET /api/v1/monetization/entitlements/me` and keeps premium affordances locked unless the Worker reports an active entitlement.

## Data Minimization

1. Do not store raw App Store receipts, Google purchase tokens, or client receipt blobs.
2. Do not store raw affiliate target URLs. Store only `target_url_hash`.
3. Do not store raw store transaction ids. Store only the Worker-side transaction hash in `subscription_entitlements.transaction_id`.
4. Ad metadata is limited to a small object of primitive values and is not a general analytics payload.
5. Secrets such as `APPLE_SHARED_SECRET` and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` must be configured only as Cloudflare secrets.
6. `GOOGLE_PLAY_PACKAGE_NAME` is a non-secret Worker var and must match the Android application id.

## User-Facing Rules

1. Sponsored or affiliate placements must be visibly labeled wherever they appear in the UI.
2. Organic recommendations must not hide paid placement status.
3. Pending entitlement verification must not unlock premium-only behavior.
4. Failed or pending purchase verification should give the user a retry path without duplicating entitlements.

## Server Rules

1. Monetization write endpoints require a bearer access token.
2. Affiliate clicks that reference a trip must verify the trip belongs to the authenticated user.
3. Retryable monetization writes should use `X-Idempotency-Key`.
4. Entitlement status is active only after trusted server verification, not from client-submitted purchase fields.
5. Store policy review is required before final app submission because Apple, Google, ad-network, and affiliate-network requirements can change.

## Remaining Release Work

1. Configure production App Store / Google Play credentials and Android package name.
2. Extend premium gates from the profile status card into every paid feature entry point.
3. Add sponsored labels to all paid recommendation surfaces.
4. Re-check current App Store, Play Store, ad-network, and affiliate-network rules before final submission.
