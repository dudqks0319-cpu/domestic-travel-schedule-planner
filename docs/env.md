# Environment Variables

This file defines where each variable is allowed to live. Do not commit real values.

## Mobile Public Env

Allowed in `apps/mobile/.env`:

```sh
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787/api/v1
EXPO_PUBLIC_MAP_PROVIDER=mock
```

Allowed map provider values are currently `mock`, `naver`, and `kakao`. The app must not read provider API secrets from public env.

## Reference Express API Env

Used only by `services/api`:

```sh
DATABASE_URL=file:./dev.db
JWT_ACCESS_SECRET=replace-with-local-secret
JWT_REFRESH_SECRET=replace-with-local-secret
DATA_GO_KR_API_KEY=replace-with-local-key
NAVER_CLIENT_ID=replace-with-local-key
NAVER_CLIENT_SECRET=replace-with-local-secret
KAKAO_REST_API_KEY=replace-with-local-key
ODSAY_API_KEY=replace-with-local-key
```

`scripts/dev-readiness-check.mjs` checks this file because the old Express API remains part of local development.

## Cloudflare Secrets

Set with `wrangler secret put` in the target environment:

```sh
wrangler secret put JWT_ACCESS_SECRET
wrangler secret put JWT_REFRESH_SECRET
wrangler secret put NAVER_CLIENT_ID
wrangler secret put NAVER_CLIENT_SECRET
wrangler secret put KAKAO_REST_API_KEY
wrangler secret put DATA_GO_KR_API_KEY
wrangler secret put ODSAY_API_KEY
wrangler secret put APPLE_SHARED_SECRET
wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
```

## Cloudflare Bindings

Configured in `services/api-worker/wrangler.toml`:

- `DB`: D1 database
- `PLACE_CACHE`: KV namespace
- `TRIPMATE_ASSETS`: R2 bucket

## Forbidden In Mobile Bundle

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `DATA_GO_KR_API_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `APPLE_SHARED_SECRET`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
