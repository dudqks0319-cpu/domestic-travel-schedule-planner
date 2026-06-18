# TripMate v1 Release Goal PR Review Notes

Branch: `agent/tripmate-v1-release-goal`

These notes are for PR reviewers. They describe the actual state of this branch and intentionally do not claim that all provider-backed v1.0 features are complete.

## Completed

- v1 development plan
- styleKey constants
- planner shared types
- Worker health and route foundation
- D1 migration
- trip CRUD baseline
- monetization scaffolding

## Not Completed Yet

- Naver adapter
- Kakao adapter
- Tour adapter
- `/places/search` implementation
- `/planner/generate` implementation
- `/routes/optimize` implementation
- real map marker/polyline provider integration

## Merge Blockers Addressed

- Worker dependency declaration: `services/api-worker/package.json` now declares Worker toolchain dev dependencies.
- Hono/custom router decision: this branch keeps the current Cloudflare Workers native `fetch` router. The v1 plan was updated so docs no longer require Hono for this branch.
- Production mock preview guard: mobile map preview now uses `EXPO_PUBLIC_APP_ENV` and never allows mock preview in production.
- Public/secret key documentation: `docs/env.md` documents Expo public keys versus server-only secrets, including Kakao key separation.

## Verification Notes

Verified locally before PR creation:

- `npm run worker:typecheck` - passed
- `npm run mobile:typecheck` - passed
- `npm run planner:build` - passed
- `npm run check:health` - passed

No requested verification command was skipped.

## Residual Review Risks

- Real provider-backed endpoints are still intentionally out of scope for this PR and should not be described as complete.
- `npm audit --workspace services/api-worker --audit-level=high` still reports dev-toolchain transitive advisories through `wrangler@4.101.0` / Miniflare (`esbuild`, `ws`). The Worker toolchain versions are pinned in this PR; dependency remediation should be handled as a separate dependency-maintenance follow-up before production deployment.
