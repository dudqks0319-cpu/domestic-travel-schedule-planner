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

## Current Security Posture

1. Health and share routes are public.
2. Trip, planner, route, and monetization routes require a bearer token before reaching handlers.
3. Bearer access tokens are verified with HS256 Web Crypto against `JWT_ACCESS_SECRET`.
4. Trip list, create, read, update, delete, day, and place handlers enforce owner-only access by filtering D1 queries with token `sub`.
5. Trip update/delete accept `X-Idempotency-Key` for retry replay and return `409` when a key is reused with a different request payload.
6. Share links are opaque `sh_` tokens, public, read-only, and return `404` when expired or missing.
7. CORS is allow-list based. `*` is ignored in production.
8. API responses include a correlation id via `X-Request-Id` and error payloads.

## Next Required Slice

1. Add monetization handlers for entitlements, ad events, and affiliate clicks.
2. Extend idempotency support to remaining retryable mutation endpoints.
3. Add JWT issuer/audience policy if the production auth provider requires it.
4. Replace `wrangler.toml` placeholder ids with real Cloudflare resource ids before preview deploy.
