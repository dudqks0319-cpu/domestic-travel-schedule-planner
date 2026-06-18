# TripMate v3.0 Product + Engineering Docs

This folder contains the v3.0 planning baseline for architecture, phased API integration, and UI/UX integration of externally provided Claude design code.

## Document Map

1. [Architecture Overview](./architecture-overview.md)
2. [API Integration Checklist by Phase](./api-integration-checklist-by-phase.md)
3. [UI/UX Notes for Claude Design Code Integration](./ui-ux-claude-design-integration-notes.md)
4. [Phase 2 Mobile UX Verification](./phase-2-mobile-ux-verification.md)
5. [Phase 3 Provider Degraded Mode](./phase-3-provider-degraded-mode.md)
6. [Cloudflare Worker Deployment Path](./cloudflare-deployment.md)
7. [Environment Variables](./env.md)

## Working Assumptions

1. Repository structure is currently scaffolded as:
   - `apps/mobile`
   - `packages/planner`
   - `services/api`
   - `services/api-worker`
2. These docs define target-state implementation guidance for TripMate v3.0.
3. Scope is intentionally practical: checklists, acceptance criteria, and immediate two-week execution steps.
