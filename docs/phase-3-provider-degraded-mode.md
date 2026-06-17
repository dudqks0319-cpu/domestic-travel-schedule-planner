# Phase 3 Provider Degraded Mode

Date: 2026-06-17
Branch: `agent/tripmate-v1-release-goal`

## Completed Scope

1. Added server-side provider gates for:
   - `PROVIDER_DATA_GO_KR_ENABLED`
   - `PROVIDER_NAVER_LOCAL_ENABLED`
2. Added placeholder credential detection for provider keys such as `replace-with-*`, `local-placeholder`, and `change-me`.
3. Tourism and restaurant endpoints now preserve the existing response shape:
   - `items` remains an array.
   - `meta` is added only when the response is degraded.
4. Mobile attraction and restaurant steps now render provider notices when degraded metadata is returned.
5. Provider skips log with provider-level tags:
   - `[provider:data-go-kr]`
   - `[provider:naver-local]`

## Degraded Response Contract

```json
{
  "items": [],
  "meta": {
    "degraded": true,
    "provider": "data-go-kr",
    "reason": "missing_credentials",
    "retryable": false
  }
}
```

Allowed `reason` values:

1. `disabled`
2. `missing_credentials`

## Verification Targets

1. API build must pass.
2. Mobile typecheck must pass.
3. Local smoke must still accept normal provider responses and degraded provider responses.
4. Manual mobile QA must show provider notices instead of hard failure copy when provider credentials are disabled or placeholders.

## Residual Risks

1. Owner: Engineering
2. Due: before Phase 3 live-provider sign-off
3. Required next action: run the same mobile 4/4 flow with real server-side provider credentials and confirm live tourism and restaurant cards render.
4. This slice does not add cache, retry, or circuit breaker policy for live provider outages.
