# TripMate Environment Variables

This document separates public Expo configuration from server-only secrets.

## Mobile Public Environment

These values can be bundled into the Expo mobile/web app.

| Variable | Allowed values / format | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_APP_ENV` | `development`, `preview`, `production` | Controls runtime safety gates in the app. Missing or unknown values fall back to `development`. |
| `EXPO_PUBLIC_ALLOW_MOCK_MAP_PREVIEW` | `true` or unset | Enables mock map preview only when `EXPO_PUBLIC_APP_ENV` is `development` or `preview`. It is ignored in `production`. |
| `EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY` | Kakao JavaScript key | Public browser map key for Kakao Maps JavaScript SDK. This is not the Kakao REST API key. |
| `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` | Kakao Native App key | Public native app key used by the Kakao native login SDK config plugin. This is not the Kakao REST API key. |

## Server-Only Secrets

Never expose these through `EXPO_PUBLIC_*`, mobile config, web bundles, logs, screenshots, or client-side storage.

| Variable | Owner | Notes |
| --- | --- | --- |
| `KAKAO_REST_API_KEY` | API / Worker only | Server-side Kakao REST API key. Do not put this in Expo public env. Web Kakao login needs a server OAuth broker before it can be enabled safely. |
| `NAVER_CLIENT_SECRET` | API / Worker only | Server-side Naver secret. |
| `DATA_GO_KR_API_KEY` | API / Worker only | Server-side public data API key. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_*` secrets | API / Worker only | JWT signing and validation secrets. |
| `APPLE_SHARED_SECRET` | Worker secret | App Store receipt verification secret. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Worker secret | Google Play verification service account JSON. |

## Production Map Guard

`apps/mobile/services/mapProvider.ts` treats production conservatively:

1. `EXPO_PUBLIC_APP_ENV=production` disables mock map preview even if `EXPO_PUBLIC_ALLOW_MOCK_MAP_PREVIEW=true`.
2. Mock map preview is available only in `development` or `preview`.
3. Production map surfaces require real provider keys such as `EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY`.
