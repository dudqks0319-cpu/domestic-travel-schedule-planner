# Security Best Practices Report

## Executive Summary
- The `/route/optimize` handler is exposed without rate limiting or authentication, so it can be flooded and push expensive downstream work onto both the API and its third-party providers.
- Each route optimization request may trigger dozens of sequential third-party calls with 3.5–4.5 s timeouts and no circuit breaker, amplifying DoS exposure and vendor cost if an attacker replays long waypoint lists or if the external APIs are slow/down.

## High Severity Findings

### 1. Unrestricted route optimizer endpoint can be abused for DoS/cost amplification
- Rule ID: EXPRESS-DOS-001 / EXPRESS-AUTH-001
- Severity: High
- Location: `src/app.ts:13-18`, `src/routes/route.ts:5-7`, `src/controllers/route-controller.ts:232-259`
- Evidence: `app.ts` only wires `helmet`, `cors`, and `express.json` before mounting `/api/v1` (which includes `/route/optimize`), and the route router exports a bare `post("/optimize", optimizeRouteHandler)` with no rate-limit/auth guard, so the handler is callable by any client repeatedly. The controller directly invokes `optimizeRoute` without throttling or per-client quotas.
- Impact: An attacker can flood `/route/optimize` with large waypoint payloads, saturating app resources (CPU, memory, event loop) and exhausting downstream provider quotas without hitting any upstream limits. Continuous floods can cause resource exhaustion, degrade other tenants, and rack up third-party billing.
- Fix: Apply a rate-limiting middleware (per IP/user/API key) before the router, and consider requiring authentication/authorization for optimization requests while allowing health checks to stay open. Use a shared store (Redis/memory) to cap requests per second/minute and enforce exponential backoff for repeat offenders.
- Mitigation: If global rate limiting isn’t available yet, gate the route behind an API key header with strict quotas and reject requests exceeding the quota before invoking `optimizeRoute`. Add instrumentation/alerts for spikes on this endpoint so operations can respond quickly.
- False positive notes: Assume there is no external gateway limiting this route. If there is already a secured gateway or WAF providing rate limits/auth, document its settings to avoid duplicate constraints.

### 2. External API calls multiply per-segment, amplifying timeouts and vendor costs under load/failure
- Rule ID: EXPRESS-SSRF-001 / EXPRESS-DOS-001
- Severity: High
- Location: `src/services/route-optimizer.ts:124-327`, `src/services/route-optimizer.ts:178-264`, `src/controllers/route-controller.ts:232-259`
- Evidence: `parsePointArray` allows up to 25 waypoints, so a request can span start + up to 25 points + optional end (segments ≈ waypoints+1). `optimizeRoute` loops over every adjacent pair and calls `estimateSegment`; each segment iterates through both configured providers and awaits their outbound `fetchJsonWithTimeout` calls (3.5–4.5 s) before falling back. Consequently, a single request can issue ~26×2=52 sequential external calls, each holding a 4 s timeout if the provider is slow or failing, while there is no circuit breaker or backoff cap that would short-circuit repeated provider hits when they are unhealthy.
- Impact: Remote attackers can amplify the cost/time of a single request by forcing the service to wait for many long-running external calls, tying up the Node.js event loop and potentially driving up Kakao/Odsay usage costs during floods. If a provider is experiencing latency or downtime, every incoming request still waits for multiple 4 s timeouts even though the fallback estimate is ultimately used, so the service degrades sharply under moderate load.
- Fix: Bound outbound work by adding per-request limits (e.g., cap segments to ≤8 when using live providers or pre-validate early), add a circuit breaker that suspends calls to a provider after N consecutive failures (and immediately serves fallback for that provider until a cooldown expires), and consider parallelizing calls with `Promise.any` while capping concurrency so slow calls don’t block other requests. Also record durations and error rates per provider to detect abuse and fail fast before hitting fallback.
- Mitigation: Cache provider responses for repeated leg combinations (e.g., tile-level), so retries/duplicate requests don’t re-query the third-party service. Use a shared request queue or worker pool to limit concurrent fetches. If a provider is down, raise the error quickly instead of waiting for every timeout by aborting outstanding fetches once the circuit breaker trips.
- False positive notes: If there are upstream edge rate limits or request proxies (e.g., Apigee, Cloudflare Workers) that already enforce low concurrency and fail-fast behavior, document them to justify less aggressive in-app controls.
