# Cloudflare Worker Deployment Path

Date: 2026-06-17
Branch: `agent/tripmate-v1-release-goal`

## Scope

This document covers the first deployable Worker foundation for `services/api-worker`.
It intentionally does not move mobile traffic to the Worker yet.

## Local Verification

```bash
npm run worker:typecheck
npm run worker:smoke:local
```

`worker:smoke:local` builds the Worker module and drives the exported `fetch` handler with `Request` objects. It verifies:

1. `GET /health`
2. `GET /api/v1/health`
3. CORS preflight
4. authenticated route denial without a bearer token
5. registered route behavior with a bearer token
6. public share route registration
7. standard 404 error schema

## Cloudflare Setup

Create Cloudflare resources before replacing placeholders in `services/api-worker/wrangler.toml`.

```bash
wrangler d1 create tripmate-preview
wrangler d1 create tripmate-production
wrangler kv namespace create PROVIDER_CACHE --preview
wrangler kv namespace create PROVIDER_CACHE
wrangler r2 bucket create tripmate-share-assets-preview
wrangler r2 bucket create tripmate-share-assets
```

Apply the D1 migration after each database id is configured:

```bash
wrangler d1 migrations apply tripmate-preview --env preview
wrangler d1 migrations apply tripmate-production --env production
```

## Required Secrets

Set secrets through Wrangler only. Do not commit provider credentials.

```bash
wrangler secret put JWT_ACCESS_SECRET --env preview
wrangler secret put JWT_REFRESH_SECRET --env preview
wrangler secret put NAVER_CLIENT_ID --env preview
wrangler secret put NAVER_CLIENT_SECRET --env preview
wrangler secret put KAKAO_REST_API_KEY --env preview
wrangler secret put DATA_GO_KR_API_KEY --env preview
wrangler secret put ODSAY_API_KEY --env preview
```

Production uses the same secret names with `--env production`.
Store verification secrets are reserved for the receipt-verification slice and must also stay server-side:

```bash
wrangler secret put APPLE_SHARED_SECRET --env preview
wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT_JSON --env preview
```

## JWT Issuer and Audience

`JWT_ISSUER` and `JWT_AUDIENCE` are non-secret Worker vars in `wrangler.toml`.
They must match the auth provider that signs mobile access tokens:

1. `JWT_ISSUER` must equal the token `iss`.
2. `JWT_AUDIENCE` must match the token `aud`. Comma-separated audiences are supported for migrations.
3. Preview and production values are placeholders until the real auth domain/client id is known.
4. A token with a valid signature but wrong issuer or audience is rejected with `401 invalid_token`.

## Current Security Posture

1. Health and share routes are public.
2. Trip, planner, route, and monetization routes require a bearer token before reaching handlers.
3. Bearer access tokens are verified with HS256 Web Crypto against `JWT_ACCESS_SECRET`, then checked against configured `JWT_ISSUER` and `JWT_AUDIENCE`.
4. Trip list, create, read, update, delete, day, and place handlers enforce owner-only access by filtering D1 queries with token `sub`.
5. Current retryable mutation handlers accept `X-Idempotency-Key` for retry replay and return `409` when a key is reused with a different request payload.
6. Monetization handlers require auth, validate inputs, hash affiliate URLs and entitlement transaction ids, and do not store raw receipts or purchase tokens.
7. Entitlement verify is a skeleton only: it records `pending_verification` and does not grant premium access until real Apple/Google server verification is implemented.
8. Share links are opaque `sh_` tokens, public, read-only, and return `404` when expired or missing.
9. CORS is allow-list based. `*` is ignored in production.
10. API responses include a correlation id via `X-Request-Id` and error payloads.

## Next Required Slice

1. Add real Apple/Google receipt verification before granting premium entitlements.
2. Replace placeholder JWT issuer/audience values with the real auth provider values before preview deploy.
3. Replace `wrangler.toml` placeholder ids with real Cloudflare resource ids before preview deploy.
