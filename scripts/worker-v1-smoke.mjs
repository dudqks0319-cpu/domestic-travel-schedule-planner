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
  npm run worker:smoke -- --base-url https://<preview-worker> --kakao-access-token "$TRIPMATE_KAKAO_ACCESS_TOKEN"
  npm run worker:smoke -- --base-url https://<preview-worker> --require-provider naver

Options:
  --base-url            Worker base URL. Default: ${DEFAULT_BASE_URL}
  --ops-token           Optional server-only token for /api/v1/ops summary and retention smoke.
  --kakao-access-token  Optional real Kakao access token for live auth verification.
  --require-provider    Optional strict live provider check: naver or kakao.

Notes:
  - The script creates and deletes smoke-owned data.
  - Kakao login uses a dev: token and therefore requires Worker ENVIRONMENT=local or preview.
  - Real Kakao token smoke logs in and logs out only; it does not delete that Kakao-backed user.
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
const liveKakaoAccessToken = readArg(
  "--kakao-access-token",
  process.env.TRIPMATE_KAKAO_ACCESS_TOKEN ?? ""
).trim();
const requiredProvider = readArg("--require-provider", process.env.TRIPMATE_REQUIRE_PROVIDER ?? "")
  .trim()
  .toLowerCase();
const allowedRequiredProviders = new Set(["", "naver", "kakao"]);

if (!allowedRequiredProviders.has(requiredProvider)) {
  throw new Error(`--require-provider must be naver or kakao when provided; got ${requiredProvider}`);
}

let accessToken = "";
let refreshToken = "";
let tripId = "";
let dayId = "";
let placeId = "";
let shareToken = "";
let workerEnvironment = "";
const limitTripIds = [];

function smokeName(prefix) {
  return `${prefix}-${Date.now()}`;
}

function buildLongExportPlaces() {
  return Array.from({ length: 46 }, (_, index) => ({
    clientId: `smoke-export-place-${index + 1}`,
    providerPlaceId: `smoke-export-provider-${index + 1}`,
    name: `강릉 PDF 다중 페이지 검증 장소 ${index + 1}`,
    category: index % 3 === 0 ? "카페" : index % 3 === 1 ? "관광지" : "맛집",
    address: `강원 강릉시 PDF 검증로 ${100 + index}`,
    lat: 37.75 + index * 0.001,
    lng: 128.89 + index * 0.001,
    dayNumber: 1,
    sortOrder: index + 1
  }));
}

async function loginWithDevKakao(label) {
  const kakaoAccessToken = label.startsWith("dev:") ? label : `dev:${smokeName(label)}`;
  const result = await request("POST", "/api/v1/auth/login/kakao", {
    auth: false,
    json: { kakaoAccessToken }
  });
  assertOk(result, "POST /api/v1/auth/login/kakao");
  accessToken = result.body?.accessToken ?? "";
  refreshToken = result.body?.refreshToken ?? "";
  assert(accessToken && refreshToken, "login should return access and refresh tokens");
}

async function loginWithLiveKakaoAccessToken() {
  const result = await request("POST", "/api/v1/auth/login/kakao", {
    auth: false,
    json: { kakaoAccessToken: liveKakaoAccessToken }
  });
  assertOk(result, "POST /api/v1/auth/login/kakao live token");
  accessToken = result.body?.accessToken ?? "";
  refreshToken = result.body?.refreshToken ?? "";
  assert(accessToken && refreshToken, "live Kakao login should return access and refresh tokens");
  assert(result.body?.user?.provider === "kakao", "live Kakao login should return Kakao provider user");
  assert(!String(result.body?.user?.email ?? "").endsWith("@tripmate.local"), "live Kakao login should not use dev-local email");
  assertOk(await request("GET", "/api/v1/auth/me"), "GET /api/v1/auth/me after live Kakao login");
  assertOk(await request("POST", "/api/v1/auth/logout"), "POST /api/v1/auth/logout after live Kakao login");
  accessToken = "";
  refreshToken = "";
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

function assertHeaderIncludes(result, headerName, expectedValue, label) {
  const actualValue = result.response.headers.get(headerName) ?? "";
  assert(
    actualValue.toLowerCase().includes(expectedValue.toLowerCase()),
    `${label}: expected ${headerName} to include "${expectedValue}", got "${actualValue}"`
  );
}

function assertRequiredProvider(provider, message) {
  if (!requiredProvider) {
    return;
  }

  assert(
    provider === requiredProvider,
    `${message}: expected ${requiredProvider}, got ${provider ?? "none"}`
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
  const safeRequestId = "worker-smoke:health-1";
  const requestIdEcho = await request("GET", "/api/v1/health", {
    auth: false,
    headers: { "x-request-id": safeRequestId }
  });
  assertOk(requestIdEcho, "GET /api/v1/health request id echo");
  assert(
    requestIdEcho.response.headers.get("x-request-id") === safeRequestId,
    "safe request id should be echoed in x-request-id"
  );
  const unsafeRequestId = "unsafe request id with spaces";
  const requestIdSanitized = await request("GET", "/api/v1/health", {
    auth: false,
    headers: { "x-request-id": unsafeRequestId }
  });
  assertOk(requestIdSanitized, "GET /api/v1/health sanitized request id");
  assert(
    requestIdSanitized.response.headers.get("x-request-id") !== unsafeRequestId,
    "unsafe request id should not be echoed in x-request-id"
  );

  workerEnvironment = v1Health.body?.environment ?? rootHealth.body?.environment ?? "";
  assert(workerEnvironment, "health response should include environment before write smoke");
  assert(
    workerEnvironment === "local" || workerEnvironment === "preview",
    `refusing write smoke against ENVIRONMENT=${workerEnvironment}; use local or preview only`
  );
});

if (liveKakaoAccessToken) {
  await step("live kakao login and logout", async () => {
    await loginWithLiveKakaoAccessToken();
  });
}

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
  assertRequiredProvider(
    generated.body?.routeSummary?.provider,
    "planner generate should return required provider route summary"
  );

  const replanned = await request("POST", "/api/v1/planner/replan", {
    auth: false,
    json: { ...input, removedPlaceIds: ["smoke-place-2"], replacementQuery: "강릉 실내" }
  });
  assertOk(replanned, "POST /api/v1/planner/replan");
  assert(replanned.body?.replan?.removedPlaceCount === 1, "planner replan should report removed place count");
  assert(Array.isArray(replanned.body?.places), "planner replan should return normalized places used for route rebuild");
  assertRequiredProvider(
    replanned.body?.routeSummary?.provider,
    "planner replan should return required provider route summary"
  );
});

await step("route optimize", async () => {
  const routePayload = {
    mode: "driving",
    points: [
      { id: "a", name: "강릉역", lat: 37.7644, lng: 128.8995 },
      { id: "b", name: "안목해변", lat: 37.7715, lng: 128.9489 }
    ]
  };
  const result = await request("POST", "/api/v1/routes/optimize", {
    auth: false,
    json: routePayload
  });
  assertOk(result, "POST /api/v1/routes/optimize");
  assert(
    ["fallback", "naver", "kakao"].includes(result.body?.route?.provider),
    "route optimize should return explicit fallback, Naver, or Kakao provider route"
  );
  assertRequiredProvider(result.body?.route?.provider, "route optimize should return required provider route");
  assert(
    result.body?.cacheStatus === "hit" || result.body?.cacheStatus === "miss",
    "route optimize should return a stable cache status"
  );

  const cachedResult = await request("POST", "/api/v1/routes/optimize", {
    auth: false,
    json: routePayload
  });
  assertOk(cachedResult, "POST /api/v1/routes/optimize cached");
  assert(cachedResult.body?.cacheStatus === "hit", "route optimize should return cacheStatus hit on repeated request");
  assertRequiredProvider(cachedResult.body?.route?.provider, "cached route optimize should return required provider route");

  const invalidCoordinateResult = await request("POST", "/api/v1/routes/optimize", {
    auth: false,
    json: {
      mode: "driving",
      points: [
        { id: "a", name: "강릉역", lat: 37.7644, lng: 128.8995 },
        { id: "invalid", name: "잘못된 좌표", lat: 999, lng: 128.9489 }
      ]
    }
  });
  assertStatus(invalidCoordinateResult, 400, "POST /api/v1/routes/optimize invalid coordinates");
  assert(
    invalidCoordinateResult.body?.error?.code === "INVALID_ROUTE_POINTS",
    "route optimize should reject invalid coordinate ranges"
  );

  const tooManyPointsResult = await request("POST", "/api/v1/routes/optimize", {
    auth: false,
    json: {
      mode: "driving",
      points: Array.from({ length: 8 }, (_, index) => ({
        id: `limit-${index + 1}`,
        name: `경로 제한 검증 ${index + 1}`,
        lat: 37.7 + index * 0.001,
        lng: 128.8 + index * 0.001
      }))
    }
  });
  assertStatus(tooManyPointsResult, 400, "POST /api/v1/routes/optimize point limit");
  assert(
    tooManyPointsResult.body?.error?.code === "ROUTE_POINT_LIMIT_EXCEEDED",
    "route optimize should reject point counts above provider policy"
  );
});

await step("places search contract", async () => {
  const result = await request("GET", "/api/v1/places/search?query=%EA%B0%95%EB%A6%89&limit=3", {
    auth: false
  });
  assertOk(result, "GET /api/v1/places/search");
  assert(Array.isArray(result.body?.places), "places search should return places array");
  if (requiredProvider) {
    assert(
      result.body.places.some((place) => place?.provider === requiredProvider),
      "places search should include required provider results"
    );
  }

  const firstPlaceId = result.body?.places?.[0]?.id;
  if (firstPlaceId) {
    assertOk(
      await request("GET", `/api/v1/places/${encodeURIComponent(firstPlaceId)}`, { auth: false }),
      "GET /api/v1/places/:placeId"
    );
  }
});

await step("places geocode contract", async () => {
  const geocode = await request("GET", "/api/v1/places/geocode?address=%EA%B0%95%EC%9B%90%20%EA%B0%95%EB%A6%89%EC%8B%9C%20%EC%B0%BD%ED%95%B4%EB%A1%9C", {
    auth: false
  });
  assertOk(geocode, "GET /api/v1/places/geocode");
  assert(Array.isArray(geocode.body?.warnings), "geocode should return warnings array");
  assert(
    geocode.body?.geocode === null ||
      (typeof geocode.body?.geocode?.lat === "number" && typeof geocode.body?.geocode?.lng === "number"),
    "geocode should return null or numeric coordinates"
  );
  if (requiredProvider) {
    assert(
      typeof geocode.body?.geocode?.lat === "number" && typeof geocode.body?.geocode?.lng === "number",
      "geocode should return required provider coordinates"
    );
    assertRequiredProvider(geocode.body?.provider, "geocode should return required provider coordinates");
  }

  const reverseGeocode = await request("GET", "/api/v1/places/reverse-geocode?lat=37.7715&lng=128.9489", {
    auth: false
  });
  assertOk(reverseGeocode, "GET /api/v1/places/reverse-geocode");
  assert(Array.isArray(reverseGeocode.body?.warnings), "reverse geocode should return warnings array");
  assert(
    reverseGeocode.body?.reverseGeocode === null ||
      typeof reverseGeocode.body?.reverseGeocode?.address === "string",
    "reverse geocode should return null or an address string"
  );
  if (requiredProvider) {
    assert(
      typeof reverseGeocode.body?.reverseGeocode?.address === "string",
      "reverse geocode should return required provider address"
    );
    assertRequiredProvider(reverseGeocode.body?.provider, "reverse geocode should return required provider address");
  }
});

await step("kakao dev login and session", async () => {
  const smokeKakaoAccessToken = `dev:${smokeName("worker-smoke")}`;
  await loginWithDevKakao(smokeKakaoAccessToken);

  assertOk(await request("GET", "/api/v1/auth/me"), "GET /api/v1/auth/me");

  const originalRefreshToken = refreshToken;
  const refreshed = await request("POST", "/api/v1/auth/refresh", {
    auth: false,
    json: { refreshToken }
  });
  assertOk(refreshed, "POST /api/v1/auth/refresh");
  accessToken = refreshed.body?.accessToken ?? accessToken;
  refreshToken = refreshed.body?.refreshToken ?? refreshToken;
  assert(
    refreshToken && refreshToken !== originalRefreshToken,
    "refresh should rotate the refresh token before reuse smoke"
  );

  const reusedRefresh = await request("POST", "/api/v1/auth/refresh", {
    auth: false,
    json: { refreshToken: originalRefreshToken }
  });
  assertStatus(reusedRefresh, 401, "POST /api/v1/auth/refresh reused token");
  assert(
    reusedRefresh.body?.error?.code === "REFRESH_EXPIRED",
    "reused refresh token should return REFRESH_EXPIRED"
  );
  assertStatus(
    await request("GET", "/api/v1/auth/me"),
    401,
    "reused refresh token should revoke the active session"
  );

  accessToken = "";
  refreshToken = "";
  await loginWithDevKakao(smokeKakaoAccessToken);
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
  const patchedPlace = await request("PATCH", `/api/v1/trips/${tripId}/places/${placeId}`, {
    json: { memo: "smoke memo", startTime: "14:30", endTime: "15:30", sortOrder: 2 }
  });
  assertOk(patchedPlace, "PATCH /api/v1/trips/:tripId/places/:placeId");
  assert(patchedPlace.body?.place?.memo === "smoke memo", "place patch should persist memo");
  assert(patchedPlace.body?.place?.startTime === "14:30", "place patch should persist startTime");
  assert(patchedPlace.body?.place?.endTime === "15:30", "place patch should persist endTime");

  const clearedPlace = await request("PATCH", `/api/v1/trips/${tripId}/places/${placeId}`, {
    json: { memo: null, startTime: null, endTime: "" }
  });
  assertOk(clearedPlace, "PATCH /api/v1/trips/:tripId/places/:placeId clear fields");
  assert(clearedPlace.body?.place?.memo === null, "place patch should clear memo with null");
  assert(clearedPlace.body?.place?.startTime === null, "place patch should clear startTime with null");
  assert(clearedPlace.body?.place?.endTime === null, "place patch should clear endTime with empty string");

  const placesAfterClear = await request("GET", `/api/v1/trips/${tripId}/places`);
  assertOk(placesAfterClear, "GET /api/v1/trips/:tripId/places after clear");
  const clearedPersistedPlace = placesAfterClear.body?.places?.find((item) => item?.id === placeId);
  assert(clearedPersistedPlace?.memo === null, "place field clear should persist memo null");
  assert(clearedPersistedPlace?.startTime === null, "place field clear should persist startTime null");
  assert(clearedPersistedPlace?.endTime === null, "place field clear should persist endTime null");

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
  shareToken = share.body?.share?.token ?? "";
  assert(shareToken, "share create should return public token");
  assert(share.body?.share?.expiresAt, "share create should return public expiry");
  const publicShare = await request("GET", `/api/v1/share/${shareToken}`, { auth: false });
  assertOk(publicShare, "GET /api/v1/share/:shareId");
  assert(!publicShare.body?.share?.token, "public share read should not echo the bearer token");
  assertHeaderIncludes(publicShare, "cache-control", "no-store", "public share read should prevent caching");
  assertHeaderIncludes(publicShare, "x-robots-tag", "noindex", "public share read should prevent indexing");
  assertHeaderIncludes(publicShare, "referrer-policy", "no-referrer", "public share read should avoid referrer leaks");

  const publicSharePage = await request("GET", `/share/${shareToken}`, { auth: false });
  assertOk(publicSharePage, "GET /share/:shareId");
  assertHeaderIncludes(publicSharePage, "cache-control", "no-store", "public share page smoke should prevent caching");
  assertHeaderIncludes(publicSharePage, "x-robots-tag", "noindex", "public share page smoke should prevent indexing");
  assertHeaderIncludes(publicSharePage, "referrer-policy", "no-referrer", "public share page smoke should avoid referrer leaks");
  assert(
    typeof publicSharePage.body === "string" &&
      publicSharePage.body.includes("장소 좌표 원문은 표시하지 않습니다."),
    "public share page smoke should disclose that raw coordinates are not shown"
  );
  assert(
    typeof publicSharePage.body === "string" &&
      !publicSharePage.body.includes(shareToken) &&
      !publicSharePage.body.includes("37.7715") &&
      !publicSharePage.body.includes("128.9489"),
    "public share page smoke should not render the share token or raw coordinates"
  );
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
    await request("POST", "/api/v1/monetization/ad-events", {
      json: {
        placement: "share_completed",
        eventType: "shown",
        metadata: { screen: "worker-smoke-share", tripId }
      }
    }),
    201,
    "POST /api/v1/monetization/ad-events share_completed"
  );
  assertStatus(
    await request("POST", "/api/v1/monetization/affiliate-clicks", {
      json: {
        provider: "hotel",
        placement: "schedule_bottom",
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
  assert(
    entitlement.body?.data?.verificationMode === "manual-non-production",
    "manual entitlement smoke should only activate through the non-production verification mode"
  );
  assert(
    entitlement.body?.data?.premium === true,
    "manual entitlement smoke should activate premium only outside production"
  );
  assert(
    entitlement.body?.data?.canUnlockPremium === true && entitlement.body?.data?.verificationRequired === false,
    "manual non-production entitlement smoke should explicitly allow premium unlock without store verification"
  );
  const storeEntitlement = await request("POST", "/api/v1/monetization/entitlements/verify", {
    json: {
      platform: "apple",
      productId: "tripmate_premium_store_smoke",
      status: "active",
      transactionId: `smoke-store-${Date.now()}`
    }
  });
  assertOk(storeEntitlement, "POST /api/v1/monetization/entitlements/verify store pending");
  assert(
    storeEntitlement.body?.data?.entitlement?.status === "pending",
    "store entitlement should remain pending until live validation is implemented"
  );
  assert(
    storeEntitlement.body?.data?.premium === false,
    "store entitlement should not unlock premium until live validation is implemented"
  );
  assert(
    storeEntitlement.body?.data?.canUnlockPremium === false && storeEntitlement.body?.data?.verificationRequired === true,
    "store entitlement should explicitly require live validation before premium unlock"
  );
  assertOk(await request("GET", "/api/v1/monetization/entitlements/me"), "GET /api/v1/monetization/entitlements/me");
});

await step("premium trip export", async () => {
  const longExportSync = await request("PATCH", `/api/v1/trips/${tripId}/places/sync`, {
    json: {
      pruneMissing: false,
      places: buildLongExportPlaces()
    }
  });
  assertOk(longExportSync, "PATCH /api/v1/trips/:tripId/places/sync long export fixture");
  assert(
    Array.isArray(longExportSync.body?.sync?.items) && longExportSync.body.sync.items.length === 46,
    "long export fixture should sync enough places for multi-page PDF"
  );

  const createdExport = await request("POST", `/api/v1/trips/${tripId}/exports`, {
    json: { format: "pdf" }
  });
  assertStatus(createdExport, 202, "POST /api/v1/trips/:tripId/exports");
  const exportId = createdExport.body?.export?.id ?? "";
  assert(exportId, "premium export should return export id");
  assert(createdExport.body?.export?.format === "pdf", "premium export should preserve requested PDF format");
  assert(createdExport.body?.export?.status === "ready", "premium PDF export should be ready immediately");
  assert(
    typeof createdExport.body?.export?.downloadUrl === "string" &&
      createdExport.body.export.downloadUrl.includes(`/api/v1/trips/${tripId}/exports/${exportId}/download`),
    "premium PDF export should return owned download URL"
  );

  const exportMetadata = await request("GET", `/api/v1/trips/${tripId}/exports/${exportId}`);
  assertOk(exportMetadata, "GET /api/v1/trips/:tripId/exports/:exportId");
  assert(exportMetadata.body?.export?.status === "ready", "premium export metadata should stay ready");

  const downloadedExport = await request("GET", `/api/v1/trips/${tripId}/exports/${exportId}/download`);
  assertOk(downloadedExport, "GET /api/v1/trips/:tripId/exports/:exportId/download");
  assertHeaderIncludes(downloadedExport, "content-type", "application/pdf", "premium export download should return PDF");
  assertHeaderIncludes(downloadedExport, "cache-control", "private", "premium export download should be private");
  assert(
    typeof downloadedExport.body === "string" &&
      downloadedExport.body.startsWith("%PDF-") &&
      downloadedExport.body.includes("TripMate"),
    "premium export download should return binary TripMate PDF content"
  );
  assert(
    /\/Count\s+([2-9]|\d{2,})/.test(downloadedExport.body),
    "premium export download should contain a multi-page PDF page count"
  );

  const sharedDownloadedExport = await request(
    "GET",
    `/api/v1/share/${shareToken}/exports/${exportId}/download`,
    { auth: false }
  );
  assertOk(sharedDownloadedExport, "GET /api/v1/share/:shareId/exports/:exportId/download");
  assertHeaderIncludes(sharedDownloadedExport, "content-type", "application/pdf", "shared export download should return PDF");
  assertHeaderIncludes(sharedDownloadedExport, "cache-control", "no-store", "shared export download should prevent caching");
  assertHeaderIncludes(sharedDownloadedExport, "x-robots-tag", "noindex", "shared export download should prevent indexing");
  assertHeaderIncludes(sharedDownloadedExport, "referrer-policy", "no-referrer", "shared export download should avoid referrer leaks");
  assert(
    typeof sharedDownloadedExport.body === "string" &&
      sharedDownloadedExport.body.startsWith("%PDF-") &&
      sharedDownloadedExport.body.includes("TripMate"),
    "shared export download should return binary TripMate PDF content"
  );
  assert(
    /\/Count\s+([2-9]|\d{2,})/.test(sharedDownloadedExport.body),
    "shared export download should contain a multi-page PDF page count"
  );

  const publicShareWithExports = await request("GET", `/api/v1/share/${shareToken}`, { auth: false });
  assertOk(publicShareWithExports, "GET /api/v1/share/:shareId after export");
  assert(
    publicShareWithExports.body?.exports?.some((item) =>
      item?.id === exportId &&
        item.downloadUrl === null
    ),
    "public share read should list ready exports without echoing bearer token URLs"
  );
  assert(
    !JSON.stringify(publicShareWithExports.body).includes(shareToken),
    "public share read should not echo bearer token through export metadata"
  );

  const publicSharePageWithExports = await request("GET", `/share/${shareToken}`, { auth: false });
  assertOk(publicSharePageWithExports, "GET /share/:shareId after export");
  assert(
    typeof publicSharePageWithExports.body === "string" &&
      publicSharePageWithExports.body.includes("공유된 일정 파일") &&
      publicSharePageWithExports.body.includes(`/api/v1/share/${shareToken}/exports/${exportId}/download`),
    "public share page should render ready shared export links"
  );

  const createdImageExport = await request("POST", `/api/v1/trips/${tripId}/exports`, {
    json: { format: "image" }
  });
  assertStatus(createdImageExport, 202, "POST /api/v1/trips/:tripId/exports image");
  const imageExportId = createdImageExport.body?.export?.id ?? "";
  assert(imageExportId, "premium image export should return export id");
  assert(createdImageExport.body?.export?.format === "image", "premium image export should preserve requested image format");
  assert(createdImageExport.body?.export?.status === "ready", "premium image export should be ready immediately");
  assert(
    typeof createdImageExport.body?.export?.downloadUrl === "string" &&
      createdImageExport.body.export.downloadUrl.includes(`/api/v1/trips/${tripId}/exports/${imageExportId}/download`),
    "premium image export should return owned download URL"
  );

  const downloadedImageExport = await request("GET", `/api/v1/trips/${tripId}/exports/${imageExportId}/download`);
  assertOk(downloadedImageExport, "GET /api/v1/trips/:tripId/exports/:exportId/download image");
  assertHeaderIncludes(downloadedImageExport, "content-type", "image/svg+xml", "premium image export download should return SVG");
  assertHeaderIncludes(downloadedImageExport, "cache-control", "private", "premium image export download should be private");
  assert(
    typeof downloadedImageExport.body === "string" && downloadedImageExport.body.includes("TripMate"),
    "premium image export download should return TripMate SVG content"
  );
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

  await step("ops sponsored place campaign", async () => {
    const sponsoredName = smokeName("스모크 스폰서 장소");
    const createResult = await request("POST", "/api/v1/ops/sponsored-places", {
      auth: false,
      headers: { authorization: `Bearer ${opsToken}` },
      json: {
        providerPlaceId: `smoke-sponsored-${Date.now()}`,
        name: sponsoredName,
        sponsorLabel: "스폰서",
        disclosureText: "광고",
        status: "active"
      }
    });
    assertStatus(createResult, 201, "POST /api/v1/ops/sponsored-places");
    const sponsorId = createResult.body?.sponsoredPlace?.id;
    assert(sponsorId, "ops sponsored place create should return id");

    const listResult = await request("GET", "/api/v1/ops/sponsored-places", {
      auth: false,
      headers: { authorization: `Bearer ${opsToken}` }
    });
    assertOk(listResult, "GET /api/v1/ops/sponsored-places");
    assert(
      Array.isArray(listResult.body?.sponsoredPlaces),
      "ops sponsored place list should return sponsoredPlaces array"
    );

    const deleteResult = await request("DELETE", `/api/v1/ops/sponsored-places/${sponsorId}`, {
      auth: false,
      headers: { authorization: `Bearer ${opsToken}` }
    });
    assertOk(deleteResult, "DELETE /api/v1/ops/sponsored-places/:sponsorId");
    assert(deleteResult.body?.deactivated === true, "ops sponsored place delete should deactivate campaign");
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

await step("cleanup smoke trip and account", async () => {
  if (placeId && tripId) {
    assertOk(await request("DELETE", `/api/v1/trips/${tripId}/places/${placeId}`), "DELETE trip place");
  }
  for (const extraTripId of limitTripIds) {
    assertOk(await request("DELETE", `/api/v1/trips/${extraTripId}`), "DELETE free limit setup trip");
  }
  if (tripId) {
    assertOk(await request("DELETE", `/api/v1/trips/${tripId}`), "DELETE trip");
  }
  if (shareToken) {
    assertStatus(
      await request("GET", `/api/v1/share/${shareToken}`, { auth: false }),
      404,
      "deleted trip share JSON should be inaccessible"
    );
    assertStatus(
      await request("GET", `/share/${shareToken}`, { auth: false }),
      404,
      "deleted trip share page should be inaccessible"
    );
  }
  assertOk(await request("DELETE", "/api/v1/auth/me"), "DELETE /api/v1/auth/me");
});

console.log(`\nTripMate Worker v1 smoke passed: ${baseUrl}`);
