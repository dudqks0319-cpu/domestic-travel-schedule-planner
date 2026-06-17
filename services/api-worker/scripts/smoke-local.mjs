import worker from "../dist/index.js";

const baseUrl = "https://worker.local";

const env = {
  ENVIRONMENT: "local",
  CORS_ALLOWED_ORIGINS: "http://localhost:8081",
  DB: {},
  PROVIDER_CACHE: {},
  SHARE_ASSETS: {}
};

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, init = {}) {
  return worker.fetch(new Request(`${baseUrl}${path}`, init), env);
}

async function main() {
  const checks = [];

  const rootHealth = await request("/health", {
    headers: { "x-request-id": "smoke-health-root" }
  });
  const rootHealthBody = await readJson(rootHealth);
  assert(rootHealth.status === 200, "GET /health should return 200");
  assert(rootHealthBody.status === "ok", "GET /health should return ok status");
  assert(rootHealth.headers.get("x-request-id") === "smoke-health-root", "GET /health should echo request id");
  checks.push("GET /health -> 200");

  const apiHealth = await request("/api/v1/health");
  const apiHealthBody = await readJson(apiHealth);
  assert(apiHealth.status === 200, "GET /api/v1/health should return 200");
  assert(apiHealthBody.bindings.d1 === true, "health should expose D1 binding presence");
  checks.push("GET /api/v1/health -> 200");

  const preflight = await request("/api/v1/trips", {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:8081",
      "access-control-request-method": "POST"
    }
  });
  assert(preflight.status === 204, "OPTIONS preflight should return 204");
  assert(
    preflight.headers.get("access-control-allow-origin") === "http://localhost:8081",
    "OPTIONS should allow configured local origin"
  );
  checks.push("OPTIONS /api/v1/trips -> 204");

  const unauthenticatedTrips = await request("/api/v1/trips");
  const unauthenticatedTripsBody = await readJson(unauthenticatedTrips);
  assert(unauthenticatedTrips.status === 401, "GET /api/v1/trips without token should return 401");
  assert(
    unauthenticatedTripsBody.error.code === "unauthorized",
    "unauthenticated trips response should use unauthorized code"
  );
  checks.push("GET /api/v1/trips without token -> 401");

  const authenticatedCreateTrip = await request("/api/v1/trips", {
    method: "POST",
    headers: {
      authorization: "Bearer local-smoke-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({ destination: "서울" })
  });
  const authenticatedCreateTripBody = await readJson(authenticatedCreateTrip);
  assert(authenticatedCreateTrip.status === 501, "POST /api/v1/trips with token should reach registered route");
  assert(
    authenticatedCreateTripBody.error.code === "not_implemented",
    "registered authenticated route should return not_implemented"
  );
  checks.push("POST /api/v1/trips with token -> 501");

  const publicShare = await request("/api/v1/share/share_123");
  const publicShareBody = await readJson(publicShare);
  assert(publicShare.status === 501, "GET /api/v1/share/:shareId should be public but not implemented");
  assert(publicShareBody.error.code === "not_implemented", "public share route should return not_implemented");
  checks.push("GET /api/v1/share/:shareId -> 501");

  const missing = await request("/unknown");
  const missingBody = await readJson(missing);
  assert(missing.status === 404, "unknown route should return 404");
  assert(missingBody.error.code === "not_found", "unknown route should use not_found code");
  checks.push("GET /unknown -> 404");

  for (const check of checks) {
    console.log(`✅ ${check}`);
  }
  console.log(`완료 / done: ${checks.length}/${checks.length} worker smoke checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
