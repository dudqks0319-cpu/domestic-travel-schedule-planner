# Privacy and Security Checklist

Use this checklist before preview deploy, production deploy, and app-store submission.

## Secrets

- [ ] Provider keys are Cloudflare secrets only.
- [ ] JWT secrets are Cloudflare secrets only.
- [ ] JWT fallback secrets are allowed only for `ENVIRONMENT=local`, never preview or production.
- [ ] Apple and Google purchase verification secrets are server-only.
- [ ] Mobile env contains only `EXPO_PUBLIC_*` values.
- [ ] gitleaks pre-commit and pre-push hooks pass.

## Authentication and Ownership

- [ ] Write APIs require authentication.
- [ ] Trip reads and writes check `user_id` ownership.
- [ ] Shared trip reads are read-only.
- [ ] Share tokens are generated from at least 256 bits of cryptographic random bytes and are URL-safe.
- [ ] Public share pages use no-store/noindex/no-referrer headers and do not render share token fragments.
- [ ] Public share JSON uses no-store/noindex/no-referrer headers and does not echo bearer share tokens.
- [ ] Mobile share fallback copy does not render bearer share URLs when clipboard/share APIs are unavailable.
- [ ] Native auth/access/refresh tokens do not fall back to AsyncStorage when SecureStore is unavailable.
- [ ] Logout clears SecureStore tokens, local trip drafts, and cached optimized routes.
- [ ] Expired sessions clear SecureStore tokens, local profile data, local trip drafts, and cached optimized routes.
- [ ] Expired-session cleanup updates AuthProvider state to unauthenticated without requiring an app restart.
- [ ] Guest profile setup stores profile preferences only and does not mint local access or refresh tokens.
- [ ] Guest/login screens do not collect passwords until an email authentication backend exists.
- [ ] Deleting a saved trip clears the matching open local draft and cached optimized route on that device.
- [ ] Schedule, route map, and search screens clear stale in-memory trip state after local trip draft cleanup.
- [ ] Account deletion and data deletion flows are exposed or documented.
- [ ] Account deletion revokes entitlements/exports and anonymizes ad and affiliate event ownership.
- [ ] Account deletion deletes owned R2 export manifest and asset objects before DB ownership cleanup.
- [ ] Account deletion clears mobile local trip drafts and cached optimized routes.

## Location and Travel Data

- [ ] Foreground location permission is not requested until a current-location feature is implemented and reviewed.
- [ ] If foreground location is introduced later, the permission copy is clear and user-triggered.
- [ ] Background/Always location permission is not requested unless a background-location feature is implemented and reviewed.
- [ ] Latitude and longitude are not shown directly in itinerary UI.
- [ ] Detailed location history is not logged.
- [ ] Production never shows synthetic coordinates as real provider places.
- [ ] Provider failure returns empty state or explicit fallback warnings.

## Monetization

- [ ] Ads do not interrupt itinerary generation.
- [ ] Sponsored places show "광고" or "스폰서".
- [ ] Affiliate URLs are hashed before logging.
- [ ] Raw purchase receipts are hashed or discarded after validation.
- [ ] Store receipt, transaction id, product id, and expiry inputs are length-limited before hashing or persistence.
- [ ] Premium digital purchases use Apple/Google billing policy.

## Operations

- [ ] CORS allowlist is explicit; empty-origin fallback is local-only, and wildcard/null/malformed origins are ignored.
- [ ] Request correlation id is returned as `x-request-id`.
- [ ] Error responses hide internal details.
- [ ] Provider calls have timeout and cache behavior.
- [ ] Route optimization rejects invalid coordinates and point counts above provider policy.
- [ ] Provider quota/rate-limit failures are tracked with safe failure kind and HTTP status metadata only.
- [ ] Audit logs avoid personal data and secrets.
- [ ] Audit metadata is allowlisted and excludes tokens, receipts, raw provider payloads, and precise coordinates.
- [ ] Trip, trip day, trip place, share link, export, and entitlement write operations create audit records.
- [ ] Ops summary reads require `OPS_ADMIN_TOKEN`, create audit records, and never store the token.
- [ ] Ops retention runs require `OPS_ADMIN_TOKEN`, support dry run, create audit records, and never store the token.
- [ ] Scheduled retention cron is deployed for preview/production and records privacy-safe operational events.
- [ ] Expired export manifests/assets are deleted from R2 and expired in D1 retention runs.
- [ ] Account deletion anonymizes prior audit log `user_id` values while retaining non-personal operational history.
