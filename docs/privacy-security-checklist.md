# Privacy and Security Checklist

Use this checklist before preview deploy, production deploy, and app-store submission.

## Secrets

- [ ] Provider keys are Cloudflare secrets only.
- [ ] JWT secrets are Cloudflare secrets only.
- [ ] Apple and Google purchase verification secrets are server-only.
- [ ] Mobile env contains only `EXPO_PUBLIC_*` values.
- [ ] gitleaks pre-commit and pre-push hooks pass.

## Authentication and Ownership

- [ ] Write APIs require authentication.
- [ ] Trip reads and writes check `user_id` ownership.
- [ ] Shared trip reads are read-only.
- [ ] Share tokens are unguessable.
- [ ] Logout clears SecureStore tokens.
- [ ] Account deletion and data deletion flows are exposed or documented.

## Location and Travel Data

- [ ] Fine location permission copy is clear.
- [ ] Latitude and longitude are not shown directly in itinerary UI.
- [ ] Detailed location history is not logged.
- [ ] Production never shows synthetic coordinates as real provider places.
- [ ] Provider failure returns empty state or explicit fallback warnings.

## Monetization

- [ ] Ads do not interrupt itinerary generation.
- [ ] Sponsored places show "광고" or "스폰서".
- [ ] Affiliate URLs are hashed before logging.
- [ ] Raw purchase receipts are hashed or discarded after validation.
- [ ] Premium digital purchases use Apple/Google billing policy.

## Operations

- [ ] CORS allowlist is explicit.
- [ ] Request correlation id is returned as `x-request-id`.
- [ ] Error responses hide internal details.
- [ ] Provider calls have timeout and cache behavior.
- [ ] Provider quota/rate-limit failures are tracked.
- [ ] Audit logs avoid personal data and secrets.
