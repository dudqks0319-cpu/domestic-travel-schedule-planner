# TripMate Monetization Policy

Date: 2026-06-17
Scope: Worker monetization scaffolding for ads, affiliate clicks, and premium entitlement state.

## Current Implementation

The Worker implements these authenticated endpoints:

1. `POST /api/v1/monetization/ad-events`
2. `POST /api/v1/monetization/affiliate-clicks`
3. `POST /api/v1/monetization/entitlements/verify`
4. `GET /api/v1/monetization/entitlements/me`

The entitlement verify endpoint is a server-side skeleton. It records a pending verification record, but it does not grant premium access until real Apple or Google server verification is implemented.

## Data Minimization

1. Do not store raw App Store receipts, Google purchase tokens, or client receipt blobs.
2. Do not store raw affiliate target URLs. Store only `target_url_hash`.
3. Do not store raw store transaction ids. Store only the Worker-side transaction hash in `subscription_entitlements.transaction_id`.
4. Ad metadata is limited to a small object of primitive values and is not a general analytics payload.
5. Secrets such as `APPLE_SHARED_SECRET` and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` must be configured only as Cloudflare secrets.

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

1. Implement real Apple receipt verification.
2. Implement real Google Play purchase verification.
3. Add premium gates in mobile UI using `GET /api/v1/monetization/entitlements/me`.
4. Add sponsored labels to all paid recommendation surfaces.
5. Re-check current App Store, Play Store, ad-network, and affiliate-network rules before final submission.
