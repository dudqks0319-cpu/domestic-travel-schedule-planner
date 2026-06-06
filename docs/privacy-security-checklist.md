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
- [ ] Public share pages use no-store/noindex/no-referrer headers and do not render share token fragments.
- [ ] Public share JSON uses no-store/noindex/no-referrer headers and does not echo bearer share tokens.
- [ ] Logout clears SecureStore tokens.
- [ ] Account deletion and data deletion flows are exposed or documented.
- [ ] Account deletion revokes entitlements/exports and anonymizes ad and affiliate event ownership.
- [ ] Account deletion deletes owned R2 export manifest and asset objects before DB ownership cleanup.
- [ ] Account deletion clears mobile local trip drafts and cached optimized routes.

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
- [ ] Audit metadata is allowlisted and excludes tokens, receipts, raw provider payloads, and precise coordinates.
- [ ] Trip, trip day, trip place, share link, export, and entitlement write operations create audit records.
- [ ] Ops summary reads require `OPS_ADMIN_TOKEN`, create audit records, and never store the token.
- [ ] Ops retention runs require `OPS_ADMIN_TOKEN`, support dry run, create audit records, and never store the token.
- [ ] Scheduled retention cron is deployed for preview/production and records privacy-safe operational events.
- [ ] Expired export manifests/assets are deleted from R2 and expired in D1 retention runs.
- [ ] Account deletion anonymizes prior audit log `user_id` values while retaining non-personal operational history.
