#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

function readArg(name, fallback) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  return fallback;
}

function shouldShowHelp() {
  return process.argv.includes("--help") || process.argv.includes("-h");
}

function printHelp() {
  console.log(`TripMate Worker v1 smoke

Usage:
  npm run worker:smoke
  npm run worker:smoke -- --base-url http://127.0.0.1:8787
  npm run worker:smoke -- --base-url https://<preview-worker> --ops-token "$OPS_ADMIN_TOKEN"

Options:
  --base-url   Worker base URL. Default: ${DEFAULT_BASE_URL}
  --ops-token  Optional server-only token for /api/v1/ops summary and retention smoke.

Notes:
  - The script creates and deletes smoke-owned data.
  - Kakao login uses a dev: token and therefore requires Worker ENVIRONMENT=local or preview.
  - The script verifies /health environment before sending write requests.
  - Do not run this write smoke against production.
`);
}

if (shouldShowHelp()) {
  printHelp();
  process.exit(0);
}

const baseUrl = readArg("--base-url", process.env.TRIPMATE_WORKER_BASE_URL ?? DEFAULT_BASE_URL)
  .replace(/\/+$/, "");
const opsToken = readArg("--ops-token", process.env.OPS_ADMIN_TOKEN ?? "");

let accessToken = "";
let refreshToken = "";
let tripId = "";
let dayId = "";
let placeId = "";
let shareId = "";
let workerEnvironment = "";
const limitTripIds = [];

function smokeName(prefix) {
  return `${prefix}-${Date.now()}`;
}

async function request(method, path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (options.auth !== false && accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.json === undefined ? undefined : JSON.stringify(options.json)
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  return { response, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertStatus(result, expected, label) {
  assert(
    result.response.status === expected,
    `${label}: expected ${expected}, got ${result.response.status} ${JSON.stringify(result.body)}`
  );
}

function assertOk(result, label) {
  assert(
    result.response.ok,
    `${label}: expected ok status, got ${result.response.status} ${JSON.stringify(result.body)}`
  );
}

async function step(label, fn) {
  process.stdout.write(`- ${label} ... `);
  await fn();
  console.log("ok");
}

await step("health endpoints", async () => {
  const rootHealth = await request("GET", "/health", { auth: false });
  assertOk(rootHealth, "GET /health");
  const v1Health = await request("GET", "/api/v1/health", { auth: false });
  assertOk(v1Health, "GET /api/v1/health");

  workerEnvironment = v1Health.body?.environment ?? rootHealth.body?.environment ?? "";
  assert(workerEnvironment, "health response should include environment before write smoke");
  assert(
    workerEnvironment === "local" || workerEnvironment === "preview",
    `refusing write smoke against ENVIRONMENT=${workerEnvironment}; use local or preview only`
  );
});

await step("planner generate and replan", async () => {
  const input = {
    destination: "강릉",
    startDate: "2026-07-01",
    endDate: "2026-07-02",
    styleKey: "sea_cafe_food",
    mode: "driving",
    places: [
      {
        id: "smoke-place-1",
        provider: "manual",
        name: "강릉 중앙시장",
        category: "맛집",
        lat: 37.7556,
        lng: 128.8961,
        tags: ["restaurant"],
        score: 80,
        isSponsored: false
      },
      {
        id: "smoke-place-2",
        provider: "manual",
        name: "안목해변 카페거리",
        category: "카페",
        lat: 37.7715,
        lng: 128.9489,
        tags: ["cafe", "sea"],
        score: 82,
        isSponsored: false
      }
    ]
  };
  const generated = await request("POST", "/api/v1/planner/generate", { auth: false, json: input });
  assertOk(generated, "POST /api/v1/planner/generate");
  assert(Array.isArray(generated.body?.days), "planner generate should return days");

  const replanned = await request("POST", "/api/v1/planner/replan", {
    auth: false,
    json: { ...input, removedPlaceIds: ["smoke-place-2"], replacementQuery: "강릉 실내" }
  });
  assertOk(replanned, "POST /api/v1/planner/replan");
  assert(replanned.body?.replan?.removedPlaceCount === 1, "planner replan should report removed place count");
  assert(Array.isArray(replanned.body?.places), "planner replan should return normalized places used for route rebuild");
});

await step("route optimize", async () => {
  const result = await request("POST", "/api/v1/routes/optimize", {
    auth: false,
    json: {
      mode: "driving",
      points: [
        { id: "a", name: "강릉역", lat: 37.7644, lng: 128.8995 },
        { id: "b", name: "안목해변", lat: 37.7715, lng: 128.9489 }
      ]
    }
  });
  assertOk(result, "POST /api/v1/routes/optimize");
  assert(result.body?.route?.provider === "fallback", "route optimize should return explicit fallback route");
});

await step("places search contract", async () => {
  const result = await request("GET", "/api/v1/places/search?query=%EA%B0%95%EB%A6%89&limit=3", {
    auth: false
  });
  assertOk(result, "GET /api/v1/places/search");
  assert(Array.isArray(result.body?.places), "places search should return places array");

  const firstPlaceId = result.body?.places?.[0]?.id;
  if (firstPlaceId) {
    assertOk(
      await request("GET", `/api/v1/places/${encodeURIComponent(firstPlaceId)}`, { auth: false }),
      "GET /api/v1/places/:placeId"
    );
  }
});

await step("kakao dev login and session", async () => {
  const result = await request("POST", "/api/v1/auth/login/kakao", {
    auth: false,
    json: { kakaoAccessToken: `dev:${smokeName("worker-smoke")}` }
  });
  assertOk(result, "POST /api/v1/auth/login/kakao");
  accessToken = result.body?.accessToken ?? "";
  refreshToken = result.body?.refreshToken ?? "";
  assert(accessToken && refreshToken, "login should return access and refresh tokens");

  assertOk(await request("GET", "/api/v1/auth/me"), "GET /api/v1/auth/me");

  const refreshed = await request("POST", "/api/v1/auth/refresh", {
    auth: false,
    json: { refreshToken }
  });
  assertOk(refreshed, "POST /api/v1/auth/refresh");
  accessToken = refreshed.body?.accessToken ?? accessToken;
  refreshToken = refreshed.body?.refreshToken ?? refreshToken;
});

await step("trip, day, place, and share CRUD", async () => {
  const trip = await request("POST", "/api/v1/trips", {
    json: {
      title: "Smoke 강릉 1박2일",
      destination: "강릉",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      styleKey: "sea_cafe_food",
      transportMode: "driving"
    }
  });
  assertStatus(trip, 201, "POST /api/v1/trips");
  tripId = trip.body?.trip?.id ?? "";
  assert(tripId, "trip create should return id");

  assertOk(await request("GET", "/api/v1/trips?include=places"), "GET /api/v1/trips");
  assertOk(await request("GET", `/api/v1/trips/${tripId}`), "GET /api/v1/trips/:tripId");
  assertOk(
    await request("PATCH", `/api/v1/trips/${tripId}`, {
      json: { title: "Smoke 강릉 수정", destination: "강릉", startDate: "2026-07-01", endDate: "2026-07-02", styleKey: "sea_cafe_food", transportMode: "driving" }
    }),
    "PATCH /api/v1/trips/:tripId"
  );

  const day = await request("POST", `/api/v1/trips/${tripId}/days`, {
    json: { dayNumber: 1, date: "2026-07-01", title: "1일차" }
  });
  assertStatus(day, 201, "POST /api/v1/trips/:tripId/days");
  dayId = day.body?.day?.id ?? "";
  assert(dayId, "day create should return id");
  assertOk(await request("GET", `/api/v1/trips/${tripId}/days`), "GET /api/v1/trips/:tripId/days");
  assertOk(
    await request("PATCH", `/api/v1/trips/${tripId}/days/${dayId}`, {
      json: { title: "도착일" }
    }),
    "PATCH /api/v1/trips/:tripId/days/:dayId"
  );

  const place = await request("POST", `/api/v1/trips/${tripId}/places`, {
    json: {
      dayId,
      dayNumber: 1,
      name: "안목해변 카페거리",
      category: "카페",
      address: "강원 강릉시 창해로",
      lat: 37.7715,
      lng: 128.9489,
      sortOrder: 1,
      startTime: "14:00",
      endTime: "15:00"
    }
  });
  assertStatus(place, 201, "POST /api/v1/trips/:tripId/places");
  placeId = place.body?.place?.id ?? "";
  assert(placeId, "place create should return id");
  assertOk(await request("GET", `/api/v1/trips/${tripId}/places`), "GET /api/v1/trips/:tripId/places");
  assertOk(
    await request("GET", `/api/v1/trips/${tripId}/days/${dayId}/places`),
    "GET /api/v1/trips/:tripId/days/:dayId/places"
  );
  const autoLinkedPlace = await request("POST", `/api/v1/trips/${tripId}/places`, {
    json: {
      dayNumber: 2,
      name: "오죽헌",
      category: "관광지",
      address: "강원 강릉시 율곡로3139번길",
      lat: 37.7794,
      lng: 128.8786,
      sortOrder: 1
    }
  });
  assertStatus(autoLinkedPlace, 201, "POST /api/v1/trips/:tripId/places dayNumber auto-link");
  assert(
    autoLinkedPlace.body?.place?.dayId && autoLinkedPlace.body.place.dayNumber === 2,
    "dayNumber-only place create should auto-link a trip day"
  );
  assertOk(
    await request("PATCH", `/api/v1/trips/${tripId}/places/${placeId}`, {
      json: { memo: "smoke memo", sortOrder: 2 }
    }),
    "PATCH /api/v1/trips/:tripId/places/:placeId"
  );
  const reorder = await request("PATCH", `/api/v1/trips/${tripId}/places/reorder`, {
    json: { places: [{ placeId, dayNumber: 1, sortOrder: 1 }] }
  });
  assertOk(reorder, "PATCH /api/v1/trips/:tripId/places/reorder");
  assert(
    Array.isArray(reorder.body?.places) && reorder.body.places.length === 1,
    "place reorder should return updated places"
  );
  const sync = await request("PATCH", `/api/v1/trips/${tripId}/places/sync`, {
    json: {
      pruneMissing: true,
      places: [
        {
          clientId: "smoke-existing-place",
          tripPlaceId: placeId,
          providerPlaceId: "smoke-existing-provider",
          name: "안목해변 카페거리",
          category: "카페",
          address: "강원 강릉시 창해로",
          lat: 37.7715,
          lng: 128.9489,
          dayNumber: 1,
          sortOrder: 1
        },
        {
          clientId: "smoke-new-place",
          providerPlaceId: "smoke-new-provider",
          name: "강릉 중앙시장",
          category: "맛집",
          address: "강원 강릉시 금성로",
          lat: 37.7548,
          lng: 128.8963,
          dayNumber: 1,
          sortOrder: 2
        }
      ]
    }
  });
  assertOk(sync, "PATCH /api/v1/trips/:tripId/places/sync");
  assert(sync.body?.sync?.created >= 1, "place sync should create missing places");
  assert(sync.body?.sync?.pruned >= 1, "place sync with pruneMissing should delete stale remote places");
  assert(
    Array.isArray(sync.body?.sync?.items) && sync.body.sync.items.length === 2,
    "place sync should return client id mappings"
  );

  const share = await request("POST", `/api/v1/trips/${tripId}/share`);
  assertStatus(share, 201, "POST /api/v1/trips/:tripId/share");
  shareId = share.body?.share?.token ?? "";
  assert(shareId, "share create should return public token");
  const publicShare = await request("GET", `/api/v1/share/${shareId}`, { auth: false });
  assertOk(publicShare, "GET /api/v1/share/:shareId");
  assert(!publicShare.body?.share?.token, "public share read should not echo the bearer token");
});

await step("free saved trip limit", async () => {
  for (const index of [2, 3]) {
    const extraTrip = await request("POST", "/api/v1/trips", {
      json: {
        title: `Smoke free limit ${index}`,
        destination: "강릉",
        startDate: "2026-07-01",
        endDate: "2026-07-02",
        styleKey: "sea_cafe_food",
        transportMode: "driving"
      }
    });
    assertStatus(extraTrip, 201, `POST /api/v1/trips free limit setup ${index}`);
    const extraTripId = extraTrip.body?.trip?.id ?? "";
    assert(extraTripId, "free limit setup trip should return id");
    limitTripIds.push(extraTripId);
  }

  const deniedTrip = await request("POST", "/api/v1/trips", {
    json: {
      title: "Smoke free limit denied",
      destination: "강릉",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      styleKey: "sea_cafe_food",
      transportMode: "driving"
    }
  });
  assertStatus(deniedTrip, 403, "POST /api/v1/trips free limit denial");
  assert(
    deniedTrip.body?.error?.code === "FREE_TRIP_LIMIT_REACHED",
    "free saved trip limit should return FREE_TRIP_LIMIT_REACHED"
  );
});

await step("monetization events and entitlement", async () => {
  assertStatus(
    await request("POST", "/api/v1/monetization/ad-events", {
      json: { placement: "plan_generated", eventType: "shown", metadata: { screen: "worker-smoke" } }
    }),
    201,
    "POST /api/v1/monetization/ad-events"
  );
  assertStatus(
    await request("POST", "/api/v1/monetization/affiliate-clicks", {
      json: {
        provider: "hotel",
        placement: "schedule",
        targetUrl: "https://example.com/tripmate-smoke",
        tripId
      }
    }),
    201,
    "POST /api/v1/monetization/affiliate-clicks"
  );
  const entitlement = await request("POST", "/api/v1/monetization/entitlements/verify", {
    json: {
      platform: "manual",
      productId: "tripmate_premium_smoke",
      status: "active"
    }
  });
  assertOk(entitlement, "POST /api/v1/monetization/entitlements/verify");
  assertOk(await request("GET", "/api/v1/monetization/entitlements/me"), "GET /api/v1/monetization/entitlements/me");
});

if (opsToken) {
  await step("ops summary", async () => {
    assertOk(
      await request("GET", "/api/v1/ops/summary?hours=1", {
        auth: false,
        headers: { authorization: `Bearer ${opsToken}` }
      }),
      "GET /api/v1/ops/summary"
    );
  });

  await step("ops retention dry run", async () => {
    const retention = await request("POST", "/api/v1/ops/retention?dryRun=true&auditDays=365&operationalDays=90", {
      auth: false,
      headers: { authorization: `Bearer ${opsToken}` }
    });
    assertOk(retention, "POST /api/v1/ops/retention?dryRun=true");
    assert(retention.body?.dryRun === true, "ops retention smoke should run in dryRun mode");
  });
}

await step("cleanup smoke trip and logout", async () => {
  if (placeId && tripId) {
    assertOk(await request("DELETE", `/api/v1/trips/${tripId}/places/${placeId}`), "DELETE trip place");
  }
  for (const extraTripId of limitTripIds) {
    assertOk(await request("DELETE", `/api/v1/trips/${extraTripId}`), "DELETE free limit setup trip");
  }
  if (tripId) {
    assertOk(await request("DELETE", `/api/v1/trips/${tripId}`), "DELETE trip");
  }
  assertOk(await request("POST", "/api/v1/auth/logout"), "POST /api/v1/auth/logout");
});

console.log(`\nTripMate Worker v1 smoke passed: ${baseUrl}`);
