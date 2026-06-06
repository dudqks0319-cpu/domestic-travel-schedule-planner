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
const tripDb = readText("services/api-worker/src/db/trips.ts");
const auditDb = readText("services/api-worker/src/db/audit.ts");
const plannerRoutes = readText("services/api-worker/src/routes/planner.ts");
const placeRoutes = readText("services/api-worker/src/routes/places.ts");
const routeRoutes = readText("services/api-worker/src/routes/routes.ts");
const monetizationRoutes = readText("services/api-worker/src/routes/monetization.ts");
const authRoutes = readText("services/api-worker/src/routes/auth.ts");
const opsRoutes = readText("services/api-worker/src/routes/ops.ts");
const v1Routes = readText("services/api-worker/src/routes/v1.ts");
const indexRoutes = readText("services/api-worker/src/index.ts");
const scheduleScreen = readText("apps/mobile/app/trip/schedule.tsx");
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
  ]
];

for (const [content, expectedText, label] of premiumStorageContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing premium storage contract: ${label}`);
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

const mobileEnvExample = readText("apps/mobile/.env.example");
for (const key of ["EXPO_PUBLIC_API_BASE_URL", "EXPO_PUBLIC_MAP_PROVIDER"]) {
  if (!mobileEnvExample.includes(key)) {
    errors.push(`Missing mobile public env example key: ${key}`);
  }
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
