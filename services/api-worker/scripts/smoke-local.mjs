import worker from "../dist/index.js";

const baseUrl = "https://worker.local";
const jwtSecret = "local-worker-smoke-secret";

const env = {
  ENVIRONMENT: "local",
  CORS_ALLOWED_ORIGINS: "http://localhost:8081",
  JWT_ACCESS_SECRET: jwtSecret,
  DB: createMockD1(),
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
  const userAToken = await createJwt({ sub: "user_a", exp: Math.floor(Date.now() / 1000) + 3600 });
  const userBToken = await createJwt({ sub: "user_b", exp: Math.floor(Date.now() / 1000) + 3600 });
  const expiredToken = await createJwt({ sub: "user_a", exp: Math.floor(Date.now() / 1000) - 60 });

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

  const malformedTokenTrips = await request("/api/v1/trips", {
    headers: {
      authorization: "Bearer local-smoke-token"
    }
  });
  const malformedTokenTripsBody = await readJson(malformedTokenTrips);
  assert(malformedTokenTrips.status === 401, "GET /api/v1/trips with malformed token should return 401");
  assert(malformedTokenTripsBody.error.code === "invalid_token", "malformed token should use invalid_token code");
  checks.push("GET /api/v1/trips with malformed token -> 401");

  const expiredTokenTrips = await request("/api/v1/trips", {
    headers: {
      authorization: `Bearer ${expiredToken}`
    }
  });
  const expiredTokenTripsBody = await readJson(expiredTokenTrips);
  assert(expiredTokenTrips.status === 401, "GET /api/v1/trips with expired token should return 401");
  assert(expiredTokenTripsBody.error.code === "token_expired", "expired token should use token_expired code");
  checks.push("GET /api/v1/trips with expired token -> 401");

  const invalidCreateTrip = await request("/api/v1/trips", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ destinationName: "서울", startDate: "2026-06-20" })
  });
  const invalidCreateTripBody = await readJson(invalidCreateTrip);
  assert(invalidCreateTrip.status === 400, "POST /api/v1/trips with missing endDate should return 400");
  assert(
    invalidCreateTripBody.error.code === "validation_failed",
    "invalid create trip response should use validation_failed code"
  );
  checks.push("POST /api/v1/trips invalid payload -> 400");

  const createdTrip = await request("/api/v1/trips", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      destinationName: "서울",
      startDate: "2026-06-20",
      endDate: "2026-06-22",
      styleKey: "healing_trip"
    })
  });
  const createdTripBody = await readJson(createdTrip);
  assert(createdTrip.status === 201, "POST /api/v1/trips with valid token should return 201");
  assert(createdTripBody.item.destinationName === "서울", "created trip should preserve destinationName");
  assert(createdTripBody.item.styleKey === "healing_trip", "created trip should preserve styleKey");
  checks.push("POST /api/v1/trips valid payload -> 201");

  const listedTrips = await request("/api/v1/trips", {
    headers: {
      authorization: `Bearer ${userAToken}`
    }
  });
  const listedTripsBody = await readJson(listedTrips);
  assert(listedTrips.status === 200, "GET /api/v1/trips with valid token should return 200");
  assert(listedTripsBody.items.length === 1, "GET /api/v1/trips should return the user's created trip");
  checks.push("GET /api/v1/trips with valid token -> 200");

  const tripId = createdTripBody.item.id;
  const ownedTrip = await request(`/api/v1/trips/${tripId}`, {
    headers: {
      authorization: `Bearer ${userAToken}`
    }
  });
  const ownedTripBody = await readJson(ownedTrip);
  assert(ownedTrip.status === 200, "GET /api/v1/trips/:tripId for owner should return 200");
  assert(ownedTripBody.item.id === tripId, "owned trip response should return requested trip id");
  checks.push("GET /api/v1/trips/:tripId owner -> 200");

  const crossUserTrip = await request(`/api/v1/trips/${tripId}`, {
    headers: {
      authorization: `Bearer ${userBToken}`
    }
  });
  const crossUserTripBody = await readJson(crossUserTrip);
  assert(crossUserTrip.status === 404, "GET /api/v1/trips/:tripId for another user should return 404");
  assert(crossUserTripBody.error.code === "not_found", "cross-user trip response should not reveal ownership");
  checks.push("GET /api/v1/trips/:tripId cross-user -> 404");

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

async function createJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`;
}

function base64UrlJson(value) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createMockD1() {
  const state = {
    trips: [],
    auditLogs: []
  };

  return {
    prepare(sql) {
      return createMockStatement(state, sql, []);
    }
  };
}

function createMockStatement(state, sql, bindings) {
  return {
    bind(...values) {
      return createMockStatement(state, sql, values);
    },
    async all() {
      const normalized = normalizeSql(sql);
      if (normalized.includes("from trips") && normalized.includes("where user_id = ?")) {
        const [userId] = bindings;
        return {
          success: true,
          meta: {},
          results: state.trips
            .filter((trip) => trip.user_id === userId)
            .sort((left, right) => right.created_at.localeCompare(left.created_at))
        };
      }

      throw new Error(`Mock D1 all() does not support query: ${sql}`);
    },
    async first() {
      const normalized = normalizeSql(sql);
      if (
        normalized.includes("from trips") &&
        normalized.includes("where id = ? and user_id = ?")
      ) {
        const [tripId, userId] = bindings;
        return state.trips.find((trip) => trip.id === tripId && trip.user_id === userId) || null;
      }

      throw new Error(`Mock D1 first() does not support query: ${sql}`);
    },
    async run() {
      const normalized = normalizeSql(sql);
      if (normalized.startsWith("insert into trips")) {
        const [
          id,
          user_id,
          title,
          destination_name,
          start_date,
          end_date,
          style_key,
          status,
          created_at,
          updated_at
        ] = bindings;
        state.trips.push({
          id,
          user_id,
          title,
          destination_name,
          start_date,
          end_date,
          style_key,
          status,
          created_at,
          updated_at
        });
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("insert into audit_logs")) {
        state.auditLogs.push(bindings);
        return { success: true, meta: {} };
      }

      throw new Error(`Mock D1 run() does not support query: ${sql}`);
    }
  };
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}
