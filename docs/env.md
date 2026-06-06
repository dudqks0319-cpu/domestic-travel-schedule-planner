# Environment Variables

This file defines where each variable is allowed to live. Do not commit real values.

## Mobile Public Env

Allowed in `apps/mobile/.env`:

```sh
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787/api/v1
EXPO_PUBLIC_MAP_PROVIDER=mock
EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY=
EXPO_PUBLIC_AFFILIATE_HOTEL_URL=
EXPO_PUBLIC_AFFILIATE_RENTAL_CAR_URL=
EXPO_PUBLIC_AFFILIATE_TICKET_URL=
EXPO_PUBLIC_AFFILIATE_INSURANCE_URL=
EXPO_PUBLIC_AFFILIATE_LOCAL_TOUR_URL=
```

Every key in mobile runtime env files must start with `EXPO_PUBLIC_`. This includes `apps/mobile/.env`, `.env.local`, `.env.development`, `.env.production`, and other `.env.*` variants. Do not add private server keys, provider REST keys, JWT secrets, admin tokens, or purchase verification secrets to any mobile env file.
The same rule applies to `apps/mobile/eas.json` build profile `env` blocks. EAS build profiles may contain only public `EXPO_PUBLIC_*` values. Store server secrets in Cloudflare, store console, or EAS secret storage only when a native SDK specifically requires a public/mobile-safe value.

Allowed map provider values are currently `mock`, `naver`, and `kakao`. The app must not read provider API secrets from public env.
`EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY` is only for Kakao's web map JavaScript SDK and must be domain-restricted in the Kakao console. It is not a replacement for `KAKAO_REST_API_KEY`, which remains server-only.
Preview and production checks fail when `EXPO_PUBLIC_MAP_PROVIDER=kakao` is configured without `EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY`.
Affiliate URLs must be HTTPS external booking URLs. They are public routing targets, not secrets. Leave them empty until a real affiliate contract/link is ready.

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
wrangler secret put OPS_ADMIN_TOKEN
```

`OPS_ADMIN_TOKEN` protects `/api/v1/ops/*` and must be a server-only random token. Do not put it in mobile env or client code. Rotate it per environment when operator access changes, after an incident, before production handoff, and on the regular operations rotation schedule.

Do not place any of the secrets above in `services/api-worker/wrangler.toml` `[vars]` or `[env.*.vars]`. Those blocks are for non-secret configuration such as `ENVIRONMENT`, `API_VERSION`, and `ALLOWED_ORIGINS`. Use `wrangler secret put` for every provider key, JWT secret, admin token, and purchase verification secret.

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
- `ODSAY_API_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `APPLE_SHARED_SECRET`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `OPS_ADMIN_TOKEN`

`npm run check:env` fails when any non-`EXPO_PUBLIC_` key or known server-only key appears in any `apps/mobile/.env*` runtime file, excluding `.env.example`. Run `npm run check:env:preview` or `npm run check:env:production` before Cloudflare deploys to fail on unresolved D1/KV/R2 placeholder IDs and unsafe production origins.
The same check fails if server-only Worker secrets are added to `wrangler.toml` vars instead of Cloudflare secrets.
For preview/production targets, the check also fails when the corresponding EAS `EXPO_PUBLIC_API_BASE_URL` still points to localhost, an example domain, or a placeholder Worker URL.
