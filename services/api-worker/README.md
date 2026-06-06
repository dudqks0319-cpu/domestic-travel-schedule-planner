# TripMate API Worker

This directory is reserved for the Cloudflare Workers + D1 API runtime.

The current production-reference implementation remains in `services/api` until the Worker service has equivalent health, places, planner, routes, trips, sharing, and monetization endpoints.

No Worker dependencies are installed yet. Add `hono`, `wrangler`, and the chosen D1 query layer only after dependency approval.

See `docs/cloudflare-workers-mvp-plan.md` for the migration plan and binding draft.
