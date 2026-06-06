import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");

function fromRoot(...parts) {
  return path.join(repoRoot, ...parts);
}

function readText(relativePath) {
  return fs.readFileSync(fromRoot(relativePath), "utf8");
}

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".expo") {
      continue;
    }

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, files);
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

const errors = [];
const warnings = [];

function requireFile(relativePath) {
  if (!fs.existsSync(fromRoot(relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

function requireText(relativePath, expectedText) {
  const content = readText(relativePath);
  if (!content.includes(expectedText)) {
    errors.push(`Missing "${expectedText}" in ${relativePath}`);
  }
}

const packageJson = JSON.parse(readText("package.json"));
const requiredRootScripts = [
  "test",
  "check:env",
  "check:health",
  "check:dev",
  "mobile:typecheck",
  "api:build",
  "planner:build",
  "worker:typecheck",
  "worker:smoke",
  "worker:deploy:preview"
];

for (const scriptName of requiredRootScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    errors.push(`Missing root package script: ${scriptName}`);
  }
}

for (const file of [
  ".github/workflows/tripmate-v1-gate.yml",
  ".github/workflows/tripmate-worker-preview-smoke.yml",
  "docs/deployment-cloudflare.md",
  "docs/env.md",
  "docs/provider-policy.md",
  "docs/monetization-policy.md",
  "docs/privacy-security-checklist.md",
  "docs/tripmate-v1-development-plan.md",
  "services/api-worker/wrangler.toml",
  "services/api-worker/src/db/schema.sql",
  "services/api-worker/migrations/0001_initial.sql",
  "services/api-worker/migrations/0002_trip_exports.sql",
  "services/api-worker/migrations/0003_operational_events.sql",
  "services/api-worker/migrations/0004_user_profile_image.sql"
]) {
  requireFile(file);
}

const tripRoutes = readText("services/api-worker/src/routes/trips.ts");
const sharePageRoutes = readText("services/api-worker/src/routes/share-page.ts");
const tripDb = readText("services/api-worker/src/db/trips.ts");
const auditDb = readText("services/api-worker/src/db/audit.ts");
const plannerRoutes = readText("services/api-worker/src/routes/planner.ts");
const placeRoutes = readText("services/api-worker/src/routes/places.ts");
const routeRoutes = readText("services/api-worker/src/routes/routes.ts");
const monetizationRoutes = readText("services/api-worker/src/routes/monetization.ts");
const authRoutes = readText("services/api-worker/src/routes/auth.ts");
const authProvider = readText("apps/mobile/app/providers/auth-provider.tsx");
const authCleanup = readText("apps/mobile/services/authCleanup.ts");
const profileScreen = readText("apps/mobile/app/(tabs)/profile.tsx");
const opsRoutes = readText("services/api-worker/src/routes/ops.ts");
const v1Routes = readText("services/api-worker/src/routes/v1.ts");
const indexRoutes = readText("services/api-worker/src/index.ts");
const scheduleScreen = readText("apps/mobile/app/trip/schedule.tsx");
const searchScreen = readText("apps/mobile/app/(tabs)/search.tsx");
const mobileApi = readText("apps/mobile/services/api.ts");
const tripHydration = readText("apps/mobile/services/tripHydration.ts");
const localTripStorage = readText("apps/mobile/services/localTripStorage.ts");
const rewardedAds = readText("apps/mobile/services/rewardedAds.ts");
const routeMapScreen = readText("apps/mobile/app/trip/route-map.tsx");
const nativeRouteMapView = readText("apps/mobile/components/map/RouteMapView.native.tsx");
const webRouteMapView = readText("apps/mobile/components/map/RouteMapView.web.tsx");
const routeApi = readText("apps/mobile/services/routeApi.ts");
const ciWorkflow = readText(".github/workflows/tripmate-v1-gate.yml");
const previewSmokeWorkflow = readText(".github/workflows/tripmate-worker-preview-smoke.yml");
const workerSmokeScript = readText("scripts/worker-v1-smoke.mjs");

const routeContracts = [
  [indexRoutes, 'app.route("/health"', "GET /health"],
  [indexRoutes, "scheduled: (controller, env, ctx)", "Cloudflare scheduled handler"],
  [v1Routes, 'v1Routes.route("/health"', "GET /api/v1/health"],
  [authRoutes, 'authRoutes.post("/login/kakao"', "POST /api/v1/auth/login/kakao"],
  [authRoutes, 'authRoutes.post("/refresh"', "POST /api/v1/auth/refresh"],
  [authRoutes, 'authRoutes.get("/me"', "GET /api/v1/auth/me"],
  [authRoutes, 'authRoutes.post("/logout"', "POST /api/v1/auth/logout"],
  [authRoutes, 'authRoutes.delete("/me"', "DELETE /api/v1/auth/me"],
  [placeRoutes, 'placeRoutes.get("/search"', "GET /api/v1/places/search"],
  [placeRoutes, 'placeRoutes.get("/:placeId"', "GET /api/v1/places/:placeId"],
  [plannerRoutes, 'plannerRoutes.post("/generate"', "POST /api/v1/planner/generate"],
  [plannerRoutes, 'plannerRoutes.post("/replan"', "POST /api/v1/planner/replan"],
  [routeRoutes, 'routeRoutes.post("/optimize"', "POST /api/v1/routes/optimize"],
  [tripRoutes, 'tripRoutes.get("/",', "GET /api/v1/trips"],
  [tripRoutes, 'tripRoutes.post("/",', "POST /api/v1/trips"],
  [tripRoutes, 'tripRoutes.get("/:tripId"', "GET /api/v1/trips/:tripId"],
  [tripRoutes, 'tripRoutes.patch("/:tripId"', "PATCH /api/v1/trips/:tripId"],
  [tripRoutes, 'tripRoutes.delete("/:tripId"', "DELETE /api/v1/trips/:tripId"],
  [tripRoutes, 'tripRoutes.post("/:tripId/days"', "POST /api/v1/trips/:tripId/days"],
  [tripRoutes, 'tripRoutes.patch("/:tripId/days/:dayId"', "PATCH /api/v1/trips/:tripId/days/:dayId"],
  [tripRoutes, 'tripRoutes.post("/:tripId/places"', "POST /api/v1/trips/:tripId/places"],
  [tripRoutes, 'tripRoutes.patch("/:tripId/places/sync"', "PATCH /api/v1/trips/:tripId/places/sync"],
  [tripRoutes, 'tripRoutes.patch("/:tripId/places/reorder"', "PATCH /api/v1/trips/:tripId/places/reorder"],
  [tripRoutes, 'tripRoutes.patch("/:tripId/places/:placeId"', "PATCH /api/v1/trips/:tripId/places/:placeId"],
  [tripRoutes, 'tripRoutes.delete("/:tripId/places/:placeId"', "DELETE /api/v1/trips/:tripId/places/:placeId"],
  [tripRoutes, 'tripRoutes.post("/:tripId/share"', "POST /api/v1/trips/:tripId/share"],
  [tripRoutes, 'shareRoutes.get("/:shareId"', "GET /api/v1/share/:shareId"],
  [tripRoutes, 'tripRoutes.post("/:tripId/exports"', "POST /api/v1/trips/:tripId/exports"],
  [tripRoutes, 'tripRoutes.get("/:tripId/exports/:exportId"', "GET /api/v1/trips/:tripId/exports/:exportId"],
  [monetizationRoutes, 'monetizationRoutes.post("/ad-events"', "POST /api/v1/monetization/ad-events"],
  [monetizationRoutes, 'monetizationRoutes.post("/affiliate-clicks"', "POST /api/v1/monetization/affiliate-clicks"],
  [monetizationRoutes, 'monetizationRoutes.post("/entitlements/verify"', "POST /api/v1/monetization/entitlements/verify"],
  [monetizationRoutes, 'monetizationRoutes.get("/entitlements/me"', "GET /api/v1/monetization/entitlements/me"],
  [opsRoutes, 'opsRoutes.get("/summary"', "GET /api/v1/ops/summary"],
  [opsRoutes, 'opsRoutes.post("/retention"', "POST /api/v1/ops/retention"]
];

for (const [content, routeText, label] of routeContracts) {
  if (!content.includes(routeText)) {
    errors.push(`Missing Worker route contract: ${label}`);
  }
}

const productionFallbackContracts = [
  [
    scheduleScreen,
    'const ALLOW_DEVELOPMENT_PREVIEW_POINTS =\n  CURRENT_NODE_ENV === "development" || CURRENT_NODE_ENV === "test";',
    "schedule synthetic preview points must be development/test gated"
  ],
  [
    routeMapScreen,
    'const ALLOW_DEVELOPMENT_PREVIEW_POINTS =\n  CURRENT_NODE_ENV === "development" || CURRENT_NODE_ENV === "test";',
    "route-map synthetic preview points must be development/test gated"
  ],
  [
    routeMapScreen,
    "shouldShowProductionFallbackWarning",
    "route-map must show production fallback warning"
  ],
  [
    routeMapScreen,
    "실제 길찾기 결과가 아닙니다",
    "route-map production fallback copy must be explicit"
  ],
  [
    scheduleScreen,
    "예상 일정표입니다",
    "schedule fallback timeline copy must be explicit"
  ],
  [
    nativeRouteMapView,
    "실제 길찾기 provider 결과가 아닌 예상 이동시간과 예상 연결선입니다.",
    "native map estimated-route copy must be explicit"
  ],
  [
    nativeRouteMapView,
    "lineDashPattern={isEstimatedRoute",
    "native map estimated route must be dashed"
  ],
  [
    webRouteMapView,
    'strokeStyle: isEstimatedRoute ? "dash" : "solid"',
    "web map estimated route must be dashed"
  ],
  [
    webRouteMapView,
    "실제 길찾기 provider 결과가 아닌 예상 이동시간과 예상 연결선입니다.",
    "web map estimated-route copy must be explicit"
  ],
  [
    routeApi,
    "if (!fallbackAllowed) {\n        throw error;\n      }",
    "route API must not silently fallback on non-recoverable provider errors"
  ]
];

for (const [content, expectedText, label] of productionFallbackContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing production fallback guard: ${label}`);
  }
}

if (scheduleScreen.includes("개발 환경에서만 저장된 경유지")) {
  errors.push("Schedule fallback copy must not claim production-visible fallback timelines are development-only.");
}

const exportDownloadContracts = [
  [
    tripRoutes,
    'tripRoutes.get("/:tripId/exports/:exportId/download"',
    "Worker must expose owned export download endpoint"
  ],
  [
    tripRoutes,
    "getOwnedTripExport(",
    "Export download must enforce trip export ownership"
  ],
  [
    tripRoutes,
    'headers.set("cache-control", "private, max-age=300")',
    "Export downloads must use private cache headers"
  ],
  [
    tripRoutes,
    "buildExportDownloadUrl(c, tripId, exportRecord.id)",
    "Export creation must return owned download URL for ready assets"
  ],
  [
    tripRoutes,
    "renderPrintableTripExport",
    "PDF export must generate print-ready HTML asset until binary renderer exists"
  ]
];

for (const [content, expectedText, label] of exportDownloadContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing export download contract: ${label}`);
  }
}

const sharePagePrivacyContracts = [
  [
    sharePageRoutes,
    "setSharePageSecurityHeaders",
    "Public share page must set privacy/security headers"
  ],
  [
    sharePageRoutes,
    '"cache-control"',
    "Public share page must set cache-control"
  ],
  [
    sharePageRoutes,
    "private, no-store",
    "Public share page must prevent shared itinerary caching"
  ],
  [
    sharePageRoutes,
    '"x-robots-tag"',
    "Public share page must set x-robots-tag"
  ],
  [
    sharePageRoutes,
    "noindex, nofollow",
    "Public share page must prevent indexing"
  ],
  [
    sharePageRoutes,
    '"referrer-policy"',
    "Public share page must set referrer-policy"
  ],
  [
    sharePageRoutes,
    "no-referrer",
    "Public share page must avoid leaking share URLs through referrers"
  ],
  [
    sharePageRoutes,
    "frame-ancestors 'none'",
    "Public share page must block framing"
  ],
  [
    sharePageRoutes,
    "장소 좌표 원문은 표시하지 않습니다",
    "Public share page must disclose that raw coordinates are not shown"
  ],
  [
    sharePageRoutes,
    "TripMate 읽기 전용 공유 일정",
    "Public share page footer must not render share token fragments"
  ]
];

for (const [content, expectedText, label] of sharePagePrivacyContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing share page privacy contract: ${label}`);
  }
}

if (sharePageRoutes.includes("공유 토큰:") || sharePageRoutes.includes("shareToken.slice")) {
  errors.push("Public share page must not render share token fragments.");
}

const publicShareApiPrivacyContracts = [
  [
    tripRoutes,
    "setPublicShareResponseHeaders",
    "Public share API must set privacy/security headers"
  ],
  [
    tripRoutes,
    "setPublicShareResponseHeaders(c);",
    "Public share API route must apply privacy/security headers"
  ],
  [
    tripRoutes,
    "private, no-store",
    "Public share API must prevent shared itinerary caching"
  ],
  [
    tripRoutes,
    "noindex, nofollow",
    "Public share API must prevent indexing"
  ],
  [
    workerSmokeScript,
    "share create should return public token",
    "Worker smoke must use the generated public share token"
  ],
  [
    workerSmokeScript,
    "public share read should not echo the bearer token",
    "Worker smoke must verify public share token redaction"
  ],
  [
    workerSmokeScript,
    "public share read should prevent caching",
    "Worker smoke must verify public share cache-control headers"
  ],
  [
    workerSmokeScript,
    "public share read should prevent indexing",
    "Worker smoke must verify public share noindex headers"
  ],
  [
    workerSmokeScript,
    "public share read should avoid referrer leaks",
    "Worker smoke must verify public share referrer-policy headers"
  ]
];

for (const [content, expectedText, label] of publicShareApiPrivacyContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing public share API privacy contract: ${label}`);
  }
}

if (tripRoutes.includes("token: sharedTrip.share_token")) {
  errors.push("Public share API must not echo sharedTrip.share_token.");
}

const mobileDayLinkContracts = [
  [
    searchScreen,
    "remotePlace?.dayId",
    "Search add-to-trip must persist the Worker-created dayId locally"
  ],
  [
    searchScreen,
    "remotePlace?.sortOrder",
    "Search add-to-trip must persist the Worker canonical sort order locally"
  ],
  [
    searchScreen,
    "nextSortOrderForDay(routePoints, dayNumber)",
    "Search add-to-trip must calculate sort order within the selected day"
  ],
  [
    scheduleScreen,
    "dayId?: string;",
    "Schedule editable trip points must carry canonical dayId"
  ],
  [
    scheduleScreen,
    "...(point.dayId ? { dayId: point.dayId } : {})",
    "Schedule currentTrip serialization must preserve canonical dayId"
  ],
  [
    scheduleScreen,
    "syncedPlace?.dayId",
    "Schedule remote sync must refresh canonical dayId from Worker places"
  ],
  [
    scheduleScreen,
    "syncedPlace?.sortOrder",
    "Schedule remote sync must refresh canonical sort order from Worker places"
  ],
  [
    scheduleScreen,
    "normalizeEditablePointSortOrders",
    "Schedule local move/delete flows must normalize per-day sort order"
  ],
  [
    scheduleScreen,
    "const syncResult = await syncPlacesToTrip(tripId, nextPoints);",
    "Schedule move/delete flows must bulk sync normalized day/order state"
  ],
  [
    scheduleScreen,
    "delete targetWithoutDayId.dayId;",
    "Schedule move flow must not keep stale dayId when moving to another day"
  ],
  [
    tripHydration,
    "place.dayId ? { dayId: place.dayId } : {}",
    "Saved trip hydration must preserve canonical dayId"
  ],
  [
    tripHydration,
    "place.sortOrder ? { sortOrder: place.sortOrder } : {}",
    "Saved trip hydration must preserve canonical sort order"
  ]
];

for (const [content, expectedText, label] of mobileDayLinkContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing mobile day-link contract: ${label}`);
  }
}

const premiumStorageContracts = [
  [
    tripRoutes,
    "FREE_TRIP_SAVE_LIMIT",
    "Worker trip creation must define the free saved-trip limit"
  ],
  [
    tripRoutes,
    "listActiveEntitlements(c.env.DB, userId)",
    "Worker trip creation must check active premium entitlements"
  ],
  [
    tripRoutes,
    "FREE_TRIP_LIMIT_REACHED",
    "Free saved-trip limit must return a stable API error code"
  ],
  [
    tripRoutes,
    "trip.create_denied",
    "Free saved-trip limit denial must be audit logged"
  ],
  [
    tripDb,
    "countActiveTrips",
    "Trip DB layer must expose an active trip count helper"
  ],
  [
    auditDb,
    '"freeLimit"',
    "Audit metadata allowlist must include the free limit"
  ],
  [
    auditDb,
    '"activeTripCountBeforeCreate"',
    "Audit metadata allowlist must include the pre-create trip count"
  ],
  [
    mobileApi,
    "isFreeTripLimitError",
    "Mobile API client must expose a free saved-trip limit error helper"
  ],
  [
    scheduleScreen,
    "saveCurrentTripToServer",
    "Schedule screen must expose a server-save action for local drafts"
  ],
  [
    scheduleScreen,
    "syncPlacesToTrip(existingTripId, editableTripPoints)",
    "Schedule screen must allow saved trips to retry place sync"
  ],
  [
    scheduleScreen,
    "{ pruneMissing: true }",
    "Schedule place sync must prune stale remote places when local state is canonical"
  ],
  [
    tripRoutes,
    "const pruneMissing = raw.pruneMissing === true;",
    "Worker place sync must require explicit pruneMissing opt-in"
  ],
  [
    workerSmokeScript,
    "place sync with pruneMissing should delete stale remote places",
    "Worker smoke must verify stale remote place pruning"
  ],
  [
    scheduleScreen,
    "장소 다시 동기화",
    "Schedule screen must label saved-trip place sync retry"
  ],
  [
    scheduleScreen,
    "무료 플랜 저장 한도",
    "Schedule screen must surface a free limit upsell message"
  ]
];

for (const [content, expectedText, label] of premiumStorageContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing premium storage contract: ${label}`);
  }
}

const rewardedExportContracts = [
  [
    rewardedAds,
    "requestRewardedExportUnlock",
    "Mobile must expose a rewarded export unlock boundary"
  ],
  [
    rewardedAds,
    'reason: "sdk_not_configured"',
    "Rewarded export boundary must not fake an earned reward before SDK integration"
  ],
  [
    scheduleScreen,
    'requestFreeExportGate("image")',
    "Schedule image export must use rewarded free-export gate for free users"
  ],
  [
    scheduleScreen,
    'requestFreeExportGate("pdf")',
    "Schedule PDF export must use rewarded free-export gate for free users"
  ],
  [
    monetizationRoutes,
    '"format"',
    "Ad event metadata allowlist must include export format"
  ]
];

for (const [content, expectedText, label] of rewardedExportContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing rewarded export contract: ${label}`);
  }
}

const mobileAuthPrivacyContracts = [
  [
    authCleanup,
    "export async function clearLocalAuthState",
    "Mobile auth cleanup must be shared outside AuthProvider"
  ],
  [
    authCleanup,
    "subscribeLocalAuthStateCleared",
    "Mobile auth cleanup must notify AuthProvider when interceptor clears local state"
  ],
  [
    authCleanup,
    "notifyLocalAuthStateCleared(reason)",
    "Mobile auth cleanup must emit the cleanup reason after local state is cleared"
  ],
  [
    authCleanup,
    "clearLocalTripDraftData(reason)",
    "Mobile logout/account cleanup must clear local trip drafts and cached routes"
  ],
  [
    authProvider,
    "subscribeLocalAuthStateCleared(() =>",
    "Mobile AuthProvider must listen for interceptor-driven local auth cleanup"
  ],
  [
    authProvider,
    "await clearLocalAuthState(\"logout\");",
    "Mobile logout must use reasoned local auth cleanup"
  ],
  [
    authProvider,
    "await clearLocalAuthState(\"account-deleted\");",
    "Mobile account deletion must use reasoned local auth cleanup"
  ],
  [
    authProvider,
    "await clearLocalAuthState(\"invalid-session\");",
    "Mobile invalid-session cleanup must use reasoned local auth cleanup"
  ],
  [
    mobileApi,
    "await clearLocalAuthState(\"expired-session\");",
    "Mobile API interceptor must clear local auth/profile/trip state when refresh cannot recover"
  ]
];

for (const [content, expectedText, label] of mobileAuthPrivacyContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing mobile auth privacy contract: ${label}`);
  }
}

const mobileTripDeletionPrivacyContracts = [
  [
    localTripStorage,
    "subscribeLocalTripDraftDataCleared",
    "Mobile local trip storage must notify mounted screens when local trip drafts are cleared"
  ],
  [
    localTripStorage,
    "notifyLocalTripDraftDataCleared(reason)",
    "Mobile local trip draft cleanup must emit a reason after clearing persisted data"
  ],
  [
    localTripStorage,
    "clearLocalTripDraftDataForTrip",
    "Mobile local trip storage must support targeted currentTrip cleanup"
  ],
  [
    localTripStorage,
    "JSON.parse(raw)",
    "Targeted currentTrip cleanup must parse the stored trip before deleting local data"
  ],
  [
    profileScreen,
    "clearLocalTripDraftDataForTrip(trip.id)",
    "Mobile trip deletion must clear matching local drafts and cached routes"
  ],
  [
    profileScreen,
    'localCleanupStatus: "cleared" | "failed" | "skipped"',
    "Mobile trip deletion must separate remote delete success from local cleanup status"
  ],
  [
    profileScreen,
    "여행은 삭제됐지만 이 기기의 열린 일정 정리는 실패했어요",
    "Mobile trip deletion must not report remote delete failure when only local cleanup fails"
  ],
  [
    profileScreen,
    "이 기기의 열린 일정",
    "Mobile trip deletion copy must explain local open-itinerary cleanup"
  ],
  [
    scheduleScreen,
    "subscribeLocalTripDraftDataCleared(() =>",
    "Schedule screen must clear in-memory itinerary state when local trip draft is cleared"
  ],
  [
    routeMapScreen,
    "subscribeLocalTripDraftDataCleared(() =>",
    "Route map screen must clear in-memory route state when local trip draft is cleared"
  ],
  [
    routeMapScreen,
    "localTripDraftCleared ? {} : params",
    "Route map screen must ignore stale route params after local trip draft cleanup"
  ],
  [
    searchScreen,
    "subscribeLocalTripDraftDataCleared(() =>",
    "Search screen must reset stale day selection when local trip draft is cleared"
  ]
];

for (const [content, expectedText, label] of mobileTripDeletionPrivacyContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing mobile trip deletion privacy contract: ${label}`);
  }
}

const requiredTables = [
  "users",
  "user_sessions",
  "trips",
  "trip_days",
  "trip_places",
  "provider_places",
  "route_cache",
  "place_cache",
  "share_links",
  "subscription_entitlements",
  "ad_events",
  "affiliate_clicks",
  "sponsored_places",
  "audit_logs",
  "trip_exports",
  "operational_events"
];
const schema = readText("services/api-worker/src/db/schema.sql");
const wranglerConfig = readText("services/api-worker/wrangler.toml");
for (const tableName of requiredTables) {
  if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}\\b`).test(schema)) {
    errors.push(`Missing D1 table in schema.sql: ${tableName}`);
  }
}

for (const text of [
  "[env.preview.triggers]",
  "[env.production.triggers]",
  "37 18 * * *",
  "17 18 * * *"
]) {
  if (!wranglerConfig.includes(text)) {
    errors.push(`Missing Worker cron trigger contract in wrangler.toml: ${text}`);
  }
}

const devReadinessCheck = readText("scripts/dev-readiness-check.mjs");
const mobileEnvExample = readText("apps/mobile/.env.example");
for (const key of [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_MAP_PROVIDER",
  "EXPO_PUBLIC_AFFILIATE_HOTEL_URL",
  "EXPO_PUBLIC_AFFILIATE_RENTAL_CAR_URL",
  "EXPO_PUBLIC_AFFILIATE_TICKET_URL",
  "EXPO_PUBLIC_AFFILIATE_INSURANCE_URL",
  "EXPO_PUBLIC_AFFILIATE_LOCAL_TOUR_URL"
]) {
  if (!mobileEnvExample.includes(key)) {
    errors.push(`Missing mobile public env example key: ${key}`);
  }
}

if (!devReadinessCheck.includes('!key.startsWith("EXPO_PUBLIC_")')) {
  errors.push("dev-readiness-check must reject non-EXPO_PUBLIC keys in apps/mobile/.env.");
}

const serverOnlyKeys = [
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
  "KAKAO_REST_API_KEY",
  "DATA_GO_KR_API_KEY",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "APPLE_SHARED_SECRET",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "ODSAY_API_KEY",
  "OPS_ADMIN_TOKEN"
];
const scannedMobileFiles = walkFiles(fromRoot("apps", "mobile"))
  .filter((file) => !file.endsWith("package-lock.json"))
  .filter((file) => !file.endsWith("README.md"));
for (const file of scannedMobileFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const key of serverOnlyKeys) {
    if (content.includes(key)) {
      errors.push(`Server-only secret key name appears in mobile bundle path: ${path.relative(repoRoot, file)} (${key})`);
    }
  }
}

for (const text of [
  "Cloudflare Workers",
  "D1",
  "KV",
  "R2",
  "worker:smoke",
  "/api/v1/ops/retention",
  "Do not run this write smoke against production"
]) {
  requireText("docs/deployment-cloudflare.md", text);
}

for (const text of [
  "npm ci",
  "npm run check:release-contract",
  "npm test",
  "npm run check:health",
  "node --check scripts/worker-v1-smoke.mjs"
]) {
  if (!ciWorkflow.includes(text)) {
    errors.push(`Missing CI release gate step: ${text}`);
  }
}

for (const text of [
  "workflow_dispatch",
  "base_url",
  "TRIPMATE_WORKER_BASE_URL",
  "OPS_ADMIN_TOKEN",
  "node --check scripts/worker-v1-smoke.mjs",
  "npm run worker:smoke -- --base-url"
]) {
  if (!previewSmokeWorkflow.includes(text)) {
    errors.push(`Missing preview smoke workflow contract: ${text}`);
  }
}

for (const text of [
  "dayNumber auto-link",
  "dayNumber-only place create should auto-link a trip day",
  "free saved trip limit",
  "FREE_TRIP_LIMIT_REACHED",
  "ops retention dry run",
  "/api/v1/ops/retention?dryRun=true"
]) {
  if (!workerSmokeScript.includes(text)) {
    errors.push(`Missing Worker smoke day auto-link assertion: ${text}`);
  }
}

for (const warning of warnings) {
  console.warn(`[check:release-contract] WARN: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[check:release-contract] ERROR: ${error}`);
  }
  process.exit(1);
}

console.log("[check:release-contract] TripMate v1 release contract looks aligned.");
