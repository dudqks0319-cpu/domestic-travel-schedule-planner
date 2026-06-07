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
const mobileAppJson = JSON.parse(readText("apps/mobile/app.json"));
const requiredRootScripts = [
  "test",
  "check:env",
  "check:health",
  "check:dev",
  "check:secrets:preview",
  "check:secrets:production",
  "d1:plan:preview",
  "d1:plan:production",
  "d1:check:preview",
  "d1:check:production",
  "d1:migrate:preview",
  "d1:migrate:production",
  "release:preview:gate",
  "release:production:gate",
  "mobile:typecheck",
  "mobile:web:qa",
  "api:build",
  "planner:build",
  "worker:typecheck",
  "worker:smoke",
  "worker:smoke:local",
  "worker:smoke:naver",
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
  "services/api-worker/src/db/sponsored-places.ts",
  "services/api-worker/migrations/0001_initial.sql",
  "services/api-worker/migrations/0002_trip_exports.sql",
  "services/api-worker/migrations/0003_operational_events.sql",
  "services/api-worker/migrations/0004_user_profile_image.sql",
  "scripts/check-cloudflare-secrets.mjs",
  "scripts/d1-migrate.mjs",
  "scripts/preview-release-gate.mjs",
  "scripts/production-release-gate.mjs",
  "scripts/worker-local-smoke.mjs"
]) {
  requireFile(file);
}

const tripRoutes = readText("services/api-worker/src/routes/trips.ts");
const sharePageRoutes = readText("services/api-worker/src/routes/share-page.ts");
const workerTokens = readText("services/api-worker/src/auth/tokens.ts");
const tripDb = readText("services/api-worker/src/db/trips.ts");
const tripExportsDb = readText("services/api-worker/src/db/exports.ts");
const auditDb = readText("services/api-worker/src/db/audit.ts");
const routeCacheDb = readText("services/api-worker/src/db/route-cache.ts");
const operationsDb = readText("services/api-worker/src/db/operations.ts");
const sponsoredPlacesDb = readText("services/api-worker/src/db/sponsored-places.ts");
const plannerRoutes = readText("services/api-worker/src/routes/planner.ts");
const placeRoutes = readText("services/api-worker/src/routes/places.ts");
const routeRoutes = readText("services/api-worker/src/routes/routes.ts");
const monetizationRoutes = readText("services/api-worker/src/routes/monetization.ts");
const authRoutes = readText("services/api-worker/src/routes/auth.ts");
const kakaoAuth = readText("services/api-worker/src/auth/kakao.ts");
const providerIndex = readText("services/api-worker/src/providers/index.ts");
const kakaoProvider = readText("services/api-worker/src/providers/kakao.ts");
const naverProvider = readText("services/api-worker/src/providers/naver.ts");
const tourProvider = readText("services/api-worker/src/providers/tour.ts");
const providerHttp = readText("services/api-worker/src/providers/http.ts");
const userDb = readText("services/api-worker/src/db/users.ts");
const rateLimitMiddleware = readText("services/api-worker/src/middleware/rate-limit.ts");
const authProvider = readText("apps/mobile/app/providers/auth-provider.tsx");
const authCleanup = readText("apps/mobile/services/authCleanup.ts");
const loginScreen = readText("apps/mobile/app/auth/login.tsx");
const signupScreen = readText("apps/mobile/app/auth/signup.tsx");
const profileSetupScreen = readText("apps/mobile/app/auth/profile-setup.tsx");
const profileScreen = readText("apps/mobile/app/(tabs)/profile.tsx");
const opsRoutes = readText("services/api-worker/src/routes/ops.ts");
const v1Routes = readText("services/api-worker/src/routes/v1.ts");
const indexRoutes = readText("services/api-worker/src/index.ts");
const scheduleScreen = readText("apps/mobile/app/trip/schedule.tsx");
const searchScreen = readText("apps/mobile/app/(tabs)/search.tsx");
const mobileApi = readText("apps/mobile/services/api.ts");
const mobileIap = readText("apps/mobile/services/iap.ts");
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
const d1MigrateScript = readText("scripts/d1-migrate.mjs");
const previewReleaseGateScript = readText("scripts/preview-release-gate.mjs");
const productionReleaseGateScript = readText("scripts/production-release-gate.mjs");
const workerLocalSmokeScript = readText("scripts/worker-local-smoke.mjs");
const cloudflareSecretsCheck = readText("scripts/check-cloudflare-secrets.mjs");
const cloudflareDeploymentDoc = readText("docs/deployment-cloudflare.md");
const apiWorkerReadme = readText("services/api-worker/README.md");

const d1MigrationRunnerContracts = [
  [
    packageJson.scripts?.["d1:plan:preview"] ?? "",
    "scripts/d1-migrate.mjs --target preview --plan",
    "Root package must expose preview D1 migration plan"
  ],
  [
    packageJson.scripts?.["d1:plan:production"] ?? "",
    "scripts/d1-migrate.mjs --target production --confirm-production --plan",
    "Root package must expose production D1 migration plan with explicit confirmation"
  ],
  [
    packageJson.scripts?.["d1:check:preview"] ?? "",
    "scripts/d1-migrate.mjs --target preview --plan --fail-on-pending",
    "Root package must expose preview D1 migration pending check"
  ],
  [
    packageJson.scripts?.["d1:check:production"] ?? "",
    "scripts/d1-migrate.mjs --target production --confirm-production --plan --fail-on-pending",
    "Root package must expose production D1 migration pending check with explicit confirmation"
  ],
  [
    packageJson.scripts?.["d1:migrate:preview"] ?? "",
    "scripts/d1-migrate.mjs --target preview",
    "Root package must expose preview D1 migration runner"
  ],
  [
    packageJson.scripts?.["d1:migrate:production"] ?? "",
    "scripts/d1-migrate.mjs --target production --confirm-production",
    "Root package must expose production D1 migration runner with explicit confirmation"
  ],
  [
    d1MigrateScript,
    "production migrations require --confirm-production",
    "D1 migration runner must require explicit production confirmation"
  ],
  [
    d1MigrateScript,
    "services/api-worker/migrations",
    "D1 migration runner must read the Worker migrations directory"
  ],
  [
    d1MigrateScript,
    '"--remote"',
    "D1 migration runner must target remote Cloudflare D1 databases"
  ],
  [
    d1MigrateScript,
    '"--env"',
    "D1 migration runner must pass the target Wrangler environment"
  ],
  [
    d1MigrateScript,
    "database_name",
    "D1 migration runner must read the configured target D1 database name"
  ],
  [
    d1MigrateScript,
    "schema_migrations",
    "D1 migration runner must maintain a migration ledger"
  ],
  [
    d1MigrateScript,
    "skip already applied",
    "D1 migration runner must skip already applied migrations"
  ],
  [
    d1MigrateScript,
    "INSERT OR IGNORE INTO",
    "D1 migration runner must record applied migrations idempotently"
  ],
  [
    d1MigrateScript,
    "plan mode: no remote writes will be executed",
    "D1 migration runner must provide a no-write plan mode"
  ],
  [
    d1MigrateScript,
    "applied=",
    "D1 migration runner plan mode must summarize applied migrations"
  ],
  [
    d1MigrateScript,
    "pending=",
    "D1 migration runner plan mode must summarize pending migrations"
  ],
  [
    d1MigrateScript,
    "--fail-on-pending requires --plan",
    "D1 migration runner must only allow pending-failure checks in plan mode"
  ],
  [
    d1MigrateScript,
    "Pending D1 migrations remain",
    "D1 migration runner must fail when pending migrations remain in check mode"
  ],
  [
    d1MigrateScript,
    "allowedFailurePattern",
    "D1 migration runner plan mode must narrow tolerated failures to known missing-ledger errors"
  ],
  [
    d1MigrateScript,
    "no such table:\\s*schema_migrations",
    "D1 migration runner plan mode must tolerate only a missing ledger table without writing"
  ]
];

for (const [content, expectedText, label] of d1MigrationRunnerContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing D1 migration runner contract: ${label}`);
  }
}

const productionReleaseGateContracts = [
  [
    packageJson.scripts?.["release:production:gate"] ?? "",
    "scripts/production-release-gate.mjs",
    "Root package must expose the production release gate"
  ],
  [
    productionReleaseGateScript,
    '["run", "check:env:production"]',
    "Production release gate must run production env readiness"
  ],
  [
    productionReleaseGateScript,
    '["run", "check:secrets:production"]',
    "Production release gate must verify Cloudflare production secret names"
  ],
  [
    productionReleaseGateScript,
    '["run", "d1:check:production"]',
    "Production release gate must fail when production D1 migrations are pending"
  ],
  [
    productionReleaseGateScript,
    '["run", "check:release-contract"]',
    "Production release gate must run release contract checks"
  ],
  [
    productionReleaseGateScript,
    '["test"]',
    "Production release gate must run planner tests"
  ],
  [
    productionReleaseGateScript,
    '["run", "check:health"]',
    "Production release gate must run build/typecheck health checks"
  ],
  [
    productionReleaseGateScript,
    'readHealthJson("/health")',
    "Production release gate must check the root health endpoint"
  ],
  [
    productionReleaseGateScript,
    'readHealthJson("/api/v1/health")',
    "Production release gate must check the v1 health endpoint"
  ],
  [
    productionReleaseGateScript,
    'body.environment !== "production"',
    "Production release gate must require ENVIRONMENT=production"
  ],
  [
    productionReleaseGateScript,
    "No production write smoke is run by this gate.",
    "Production release gate must document that it does not run write smoke"
  ],
  [
    productionReleaseGateScript,
    "real deployed production Worker URL",
    "Production release gate must reject placeholder production URLs"
  ]
];

for (const [content, expectedText, label] of productionReleaseGateContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing production release gate contract: ${label}`);
  }
}

if (productionReleaseGateScript.includes('"worker:smoke"') || productionReleaseGateScript.includes("worker:smoke:naver")) {
  errors.push("Production release gate must not invoke Worker write smoke scripts.");
}

const previewReleaseGateContracts = [
  [
    packageJson.scripts?.["release:preview:gate"] ?? "",
    "scripts/preview-release-gate.mjs",
    "Root package must expose the preview release gate"
  ],
  [
    previewReleaseGateScript,
    '["run", "check:env:preview"]',
    "Preview release gate must run preview env readiness"
  ],
  [
    previewReleaseGateScript,
    '["run", "check:secrets:preview"]',
    "Preview release gate must verify Cloudflare preview secret names"
  ],
  [
    previewReleaseGateScript,
    '["run", "d1:check:preview"]',
    "Preview release gate must fail when preview D1 migrations are pending"
  ],
  [
    previewReleaseGateScript,
    '["run", "check:release-contract"]',
    "Preview release gate must run release contract checks"
  ],
  [
    previewReleaseGateScript,
    '["test"]',
    "Preview release gate must run planner tests"
  ],
  [
    previewReleaseGateScript,
    '["run", "check:health"]',
    "Preview release gate must run build/typecheck health checks"
  ],
  [
    previewReleaseGateScript,
    '"--require-provider", requiredProvider',
    "Preview release gate must run strict provider smoke by default"
  ],
  [
    previewReleaseGateScript,
    "OPS_ADMIN_TOKEN: opsToken",
    "Preview release gate must pass the ops token through environment only"
  ],
  [
    previewReleaseGateScript,
    "real deployed preview Worker URL",
    "Preview release gate must reject placeholder preview URLs"
  ]
];

for (const [content, expectedText, label] of previewReleaseGateContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing preview release gate contract: ${label}`);
  }
}

const workerLocalSmokeContracts = [
  [
    packageJson.scripts?.["worker:smoke:local"] ?? "",
    "scripts/worker-local-smoke.mjs",
    "Root package must expose the local Worker smoke gate"
  ],
  [
    workerLocalSmokeScript,
    "fs.readdirSync(migrationsDir)",
    "Local Worker smoke gate must discover D1 migrations from the migrations directory"
  ],
  [
    workerLocalSmokeScript,
    "/^\\d{4}_.+\\.sql$/.test(entry)",
    "Local Worker smoke gate must filter migration SQL filenames"
  ],
  [
    workerLocalSmokeScript,
    "No D1 migrations found",
    "Local Worker smoke gate must fail when no migrations are discovered"
  ],
  [
    workerLocalSmokeScript,
    "schema_migrations",
    "Local Worker smoke gate must use a local migration ledger"
  ],
  [
    workerLocalSmokeScript,
    "skip already applied",
    "Local Worker smoke gate must skip ledger-recorded migrations"
  ],
  [
    workerLocalSmokeScript,
    "INSERT OR IGNORE INTO",
    "Local Worker smoke gate must record applied migrations idempotently"
  ],
  [
    workerLocalSmokeScript,
    "verifyMigrationLedger",
    "Local Worker smoke gate must verify migration ledger entries before runtime smoke"
  ],
  [
    workerLocalSmokeScript,
    "missing local D1 migration ledger entries",
    "Local Worker smoke gate must fail on missing migration ledger entries"
  ],
  [
    workerLocalSmokeScript,
    "verified local D1 migration ledger",
    "Local Worker smoke gate must report successful migration ledger verification"
  ],
  [
    workerLocalSmokeScript,
    "pragma_table_info('users')",
    "Local Worker smoke gate must detect already-applied profile image migration"
  ],
  [
    workerLocalSmokeScript,
    "users.profile_image already exists",
    "Local Worker smoke gate must skip the idempotent local profile image migration when needed"
  ],
  [
    workerLocalSmokeScript,
    '["run", "worker:dev"]',
    "Local Worker smoke gate must start wrangler dev through the root worker:dev script"
  ],
  [
    workerLocalSmokeScript,
    '["run", "worker:smoke", "--", "--base-url", baseUrl]',
    "Local Worker smoke gate must run the full Worker v1 smoke script"
  ],
  [
    workerLocalSmokeScript,
    "stopWorker()",
    "Local Worker smoke gate must stop the dev server after smoke execution"
  ]
];

for (const [content, expectedText, label] of workerLocalSmokeContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing local Worker smoke contract: ${label}`);
  }
}

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
  [placeRoutes, 'placeRoutes.get("/geocode"', "GET /api/v1/places/geocode"],
  [placeRoutes, 'placeRoutes.get("/reverse-geocode"', "GET /api/v1/places/reverse-geocode"],
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
  [tripRoutes, 'shareRoutes.get("/:shareId/exports/:exportId/download"', "GET /api/v1/share/:shareId/exports/:exportId/download"],
  [tripRoutes, 'tripRoutes.post("/:tripId/exports"', "POST /api/v1/trips/:tripId/exports"],
  [tripRoutes, 'tripRoutes.get("/:tripId/exports/:exportId"', "GET /api/v1/trips/:tripId/exports/:exportId"],
  [monetizationRoutes, 'monetizationRoutes.post("/ad-events"', "POST /api/v1/monetization/ad-events"],
  [monetizationRoutes, 'monetizationRoutes.post("/affiliate-clicks"', "POST /api/v1/monetization/affiliate-clicks"],
  [monetizationRoutes, 'monetizationRoutes.post("/entitlements/verify"', "POST /api/v1/monetization/entitlements/verify"],
  [monetizationRoutes, 'monetizationRoutes.get("/entitlements/me"', "GET /api/v1/monetization/entitlements/me"],
  [opsRoutes, 'opsRoutes.get("/summary"', "GET /api/v1/ops/summary"],
  [opsRoutes, 'opsRoutes.post("/retention"', "POST /api/v1/ops/retention"],
  [opsRoutes, 'opsRoutes.get("/sponsored-places"', "GET /api/v1/ops/sponsored-places"],
  [opsRoutes, 'opsRoutes.post("/sponsored-places"', "POST /api/v1/ops/sponsored-places"],
  [opsRoutes, 'opsRoutes.patch("/sponsored-places/:sponsorId"', "PATCH /api/v1/ops/sponsored-places/:sponsorId"],
  [opsRoutes, 'opsRoutes.delete("/sponsored-places/:sponsorId"', "DELETE /api/v1/ops/sponsored-places/:sponsorId"]
];

for (const [content, routeText, label] of routeContracts) {
  if (!content.includes(routeText)) {
    errors.push(`Missing Worker route contract: ${label}`);
  }
}

const authSecurityContracts = [
  [
    authRoutes,
    'keyPrefix: "auth_kakao_login"',
    "Kakao login endpoint must be rate limited"
  ],
  [
    authRoutes,
    'keyPrefix: "auth_refresh"',
    "Refresh endpoint must be rate limited"
  ],
  [
    kakaoAuth,
    'env.ENVIRONMENT === "local" || env.ENVIRONMENT === "preview"',
    "Kakao dev login tokens must be limited to local/preview"
  ],
  [
    kakaoAuth,
    'trimmed.startsWith("dev:")',
    "Kakao dev login token path must stay explicit"
  ],
  [
    kakaoAuth,
    'fetchProvider("https://kapi.kakao.com/v2/user/me"',
    "Kakao userinfo verification must use the provider timeout helper"
  ]
];

for (const [content, expectedText, label] of authSecurityContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing auth security contract: ${label}`);
  }
}

const accountDeletionContracts = [
  [
    authRoutes,
    "listUserTripExportObjectKeys(c.env.DB, userId)",
    "Account deletion must collect owned export object keys before DB cleanup"
  ],
  [
    authRoutes,
    "c.env.TRIPMATE_ASSETS.delete(key)",
    "Account deletion must delete owned R2 export objects"
  ],
  [
    authRoutes,
    'action: "user.delete"',
    "Account deletion must create a privacy-safe audit event"
  ],
  [
    authRoutes,
    "anonymizeAuditLogsForUser(c.env.DB, userId)",
    "Account deletion must anonymize historical audit ownership"
  ],
  [
    userDb,
    "UPDATE user_sessions",
    "Account deletion must revoke user sessions"
  ],
  [
    userDb,
    "UPDATE trips",
    "Account deletion must soft-delete trips"
  ],
  [
    userDb,
    "UPDATE trip_days",
    "Account deletion must soft-delete trip days"
  ],
  [
    userDb,
    "UPDATE trip_places",
    "Account deletion must soft-delete trip places"
  ],
  [
    userDb,
    "UPDATE share_links",
    "Account deletion must disable share links"
  ],
  [
    userDb,
    "UPDATE trip_exports",
    "Account deletion must expire trip exports"
  ],
  [
    userDb,
    "UPDATE subscription_entitlements",
    "Account deletion must revoke premium entitlements"
  ],
  [
    userDb,
    "UPDATE ad_events",
    "Account deletion must anonymize ad event ownership"
  ],
  [
    userDb,
    "UPDATE affiliate_clicks",
    "Account deletion must anonymize affiliate click ownership"
  ],
  [
    authProvider,
    'clearLocalAuthState("account-deleted")',
    "Mobile account deletion must clear SecureStore tokens and local trip draft data"
  ],
  [
    profileScreen,
    "계정 및 데이터 삭제",
    "Mobile profile must expose an account/data deletion entry point"
  ]
];

for (const [content, expectedText, label] of accountDeletionContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing account deletion contract: ${label}`);
  }
}

const geocodeContracts = [
  [
    naverProvider,
    "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode",
    "Naver provider must call the Naver Cloud Geocoding API"
  ],
  [
    naverProvider,
    "https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc",
    "Naver provider must call the Naver Cloud Reverse Geocoding API"
  ],
  [
    naverProvider,
    "naverCloudHeaders(this.env)",
    "Naver geocode calls must use server-only NCP credentials"
  ],
  [
    naverProvider,
    "env.NAVER_MAPS_CLIENT_ID ?? env.NAVER_CLIENT_ID",
    "Naver Cloud Maps calls must prefer split Maps credentials with legacy fallback"
  ],
  [
    naverProvider,
    "env.NAVER_SEARCH_CLIENT_ID ?? env.NAVER_CLIENT_ID",
    "Naver Local Search calls must prefer split Search credentials with legacy fallback"
  ],
  [
    providerIndex,
    "new NaverPlaceAdapter(env),\n    new KakaoPlaceAdapter(env)",
    "Provider geocode orchestration must try Naver before Kakao"
  ],
  [
    kakaoProvider,
    "https://dapi.kakao.com/v2/local/search/address.json",
    "Kakao provider must call the Local address search API for geocoding"
  ],
  [
    kakaoProvider,
    "https://dapi.kakao.com/v2/local/geo/coord2address.json",
    "Kakao provider must call the Local coord2address API for reverse geocoding"
  ],
  [
    kakaoProvider,
    "KakaoAK ${this.env.KAKAO_REST_API_KEY}",
    "Kakao geocode calls must use the server-only REST API key"
  ],
  [
    providerIndex,
    "GEOCODE_TTL_SECONDS",
    "Provider geocode results must be cached"
  ],
  [
    providerIndex,
    '"geocode:v2"',
    "Geocode cache keys must be versioned after adding provider metadata"
  ],
  [
    providerIndex,
    '"reverse-geocode:v2"',
    "Reverse geocode cache keys must be versioned after adding provider metadata"
  ],
  [
    providerIndex,
    "geocodeAddress",
    "Provider index must expose cached geocode lookup"
  ],
  [
    providerIndex,
    "reverseGeocodeCoordinate",
    "Provider index must expose cached reverse geocode lookup"
  ],
  [
    providerIndex,
    "provider = adapter.provider;",
    "Geocode and reverse geocode cache payloads must preserve provider metadata"
  ],
  [
    providerIndex,
    'eventType: "provider_geocode"',
    "Geocode provider calls must record operational events"
  ],
  [
    providerIndex,
    'eventType: "provider_reverse_geocode"',
    "Reverse geocode provider calls must record operational events"
  ],
  [
    placeRoutes,
    'placeRoutes.use("/geocode", rateLimit({',
    "Geocode endpoint must be rate limited"
  ],
  [
    placeRoutes,
    'placeRoutes.use("/reverse-geocode", rateLimit({',
    "Reverse geocode endpoint must be rate limited"
  ],
  [
    placeRoutes,
    "provider: result.provider",
    "Geocode endpoints must return provider metadata for live smoke validation"
  ],
  [
    placeRoutes,
    "ADDRESS_REQUIRED",
    "Geocode endpoint must validate address input"
  ],
  [
    placeRoutes,
    "COORDINATES_REQUIRED",
    "Reverse geocode endpoint must validate coordinates"
  ],
  [
    mobileApi,
    "GeocodeDto",
    "Mobile API client must expose geocode response types"
  ],
  [
    mobileApi,
    "provider: PlaceProviderDto | null",
    "Mobile API geocode client must expose provider metadata returned by the Worker"
  ],
  [
    mobileApi,
    "placesApi = {",
    "Mobile places API namespace must remain available"
  ],
  [
    mobileApi,
    "geocode: (address: string)",
    "Mobile places API must expose geocode"
  ],
  [
    mobileApi,
    "reverseGeocode: (lat: number, lng: number)",
    "Mobile places API must expose reverse geocode"
  ]
];

for (const [content, expectedText, label] of geocodeContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing geocode contract: ${label}`);
  }
}

const providerTimeoutContracts = [
  [
    providerHttp,
    "DEFAULT_PROVIDER_TIMEOUT_MS = 4500",
    "Provider HTTP helper must define a bounded default timeout"
  ],
  [
    providerHttp,
    "new AbortController()",
    "Provider HTTP helper must abort slow provider calls"
  ],
  [
    providerHttp,
    "clearTimeout(timeoutId)",
    "Provider HTTP helper must clear timeout handles"
  ],
  [
    naverProvider,
    "fetchProvider(url",
    "Naver provider calls must use the timeout helper"
  ],
  [
    kakaoProvider,
    "fetchProvider(url",
    "Kakao provider calls must use the timeout helper"
  ],
  [
    tourProvider,
    "fetchProvider(url",
    "Tour provider calls must use the timeout helper"
  ],
  [
    providerIndex,
    "Promise.allSettled",
    "Provider search must continue when one provider fails or times out"
  ],
  [
    providerIndex,
    "warnings.push(`${result.value.provider} returned no places`)",
    "Provider search must surface empty provider results as warnings"
  ]
];

for (const [content, expectedText, label] of providerTimeoutContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing provider timeout contract: ${label}`);
  }
}

const directionsProviderContracts = [
  [
    naverProvider,
    "https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving",
    "Naver provider must call the Naver Directions 5 driving API"
  ],
  [
    naverProvider,
    '"x-ncp-apigw-api-key-id"',
    "Naver directions provider must use server-only NCP key id"
  ],
  [
    naverProvider,
    '"x-ncp-apigw-api-key"',
    "Naver directions provider must use server-only NCP API key"
  ],
  [
    naverProvider,
    'provider: "naver"',
    "Naver directions provider must return normalized Naver routes"
  ],
  [
    providerIndex,
    "new NaverPlaceAdapter(env),\n    new KakaoPlaceAdapter(env)",
    "Directions orchestration must try Naver before Kakao"
  ],
  [
    kakaoProvider,
    "https://apis-navi.kakaomobility.com/v1/directions",
    "Kakao provider must call the Kakao Mobility directions API"
  ],
  [
    kakaoProvider,
    'input.mode !== "driving"',
    "Kakao directions provider must only claim supported driving routes"
  ],
  [
    kakaoProvider,
    'url.searchParams.set("waypoints"',
    "Kakao directions provider must pass intermediate waypoints"
  ],
  [
    kakaoProvider,
    'url.searchParams.set("summary", "false")',
    "Kakao directions provider must request section details"
  ],
  [
    kakaoProvider,
    'provider: "kakao"',
    "Kakao directions provider must return normalized Kakao routes"
  ],
  [
    providerIndex,
    "getProviderDirections",
    "Provider index must expose directions orchestration"
  ],
  [
    plannerRoutes,
    "hasNaverMapsCredentials(env) || Boolean(env.KAKAO_REST_API_KEY)",
    "Planner provider route enrichment must run with Naver or Kakao directions credentials"
  ],
  [
    plannerRoutes,
    "Route provider could not enrich planner day routes",
    "Planner provider route warning must not be Kakao-specific"
  ],
  [
    providerIndex,
    'eventType: "provider_directions"',
    "Directions provider calls must record operational events"
  ],
  [
    routeRoutes,
    "getProviderDirections(c.env",
    "Route optimize must attempt provider directions before fallback"
  ],
  [
    routeRoutes,
    "providerCacheScopes(c.env, selectedMode)",
    "Route optimize must separate provider and fallback cache scopes"
  ],
  [
    routeRoutes,
    "await createRouteCacheKey(selectedMode, points, providerResult.route.provider)",
    "Route optimize must cache provider routes under the actual winning provider"
  ],
  [
    routeCacheDb,
    "providerScope",
    "Route cache keys must include provider scope"
  ],
  [
    workerSmokeScript,
    "route optimize should return explicit fallback, Naver, or Kakao provider route",
    "Worker smoke must accept real Naver/Kakao directions or explicit fallback"
  ]
];

for (const [content, expectedText, label] of directionsProviderContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing directions provider contract: ${label}`);
  }
}

const plannerProviderRouteContracts = [
  [
    plannerRoutes,
    "enrichPlanWithProviderRoutes",
    "Planner routes must enrich generated plans with provider route data when available"
  ],
  [
    plannerRoutes,
    "getProviderDirections(env",
    "Planner route enrichment must use the provider directions orchestrator"
  ],
  [
    plannerRoutes,
    "rebuildDayPlacesWithSegments",
    "Planner route enrichment must update TripPlace routeToNext segments"
  ],
  [
    plannerRoutes,
    "rebuildRouteSummary(days",
    "Planner route enrichment must rebuild RouteSummary from enriched segments"
  ],
  [
    plannerRoutes,
    'provider: plan.routeSummary.provider',
    "Planner operational events must record the route provider without unsafe metadata keys"
  ],
  [
    plannerRoutes,
    'code: "ROUTE_PROVIDER_WARNING"',
    "Planner route provider failures must surface as recoverable provider warnings"
  ]
];

for (const [content, expectedText, label] of plannerProviderRouteContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing planner provider route contract: ${label}`);
  }
}

const rateLimitContracts = [
  [
    placeRoutes,
    'placeRoutes.use("/search", rateLimit({',
    "Place search route must install rate limiting before provider calls"
  ],
  [
    placeRoutes,
    'keyPrefix: "places_search"',
    "Place search rate limit must use a stable KV key prefix"
  ],
  [
    placeRoutes,
    "limit: 60",
    "Place search rate limit must match provider policy"
  ],
  [
    placeRoutes,
    "windowSeconds: 60",
    "Place search rate limit window must match provider policy"
  ],
  [
    plannerRoutes,
    'plannerRoutes.use("/generate", rateLimit({',
    "Planner generate route must install rate limiting before provider calls"
  ],
  [
    plannerRoutes,
    'keyPrefix: "planner_generate"',
    "Planner generate rate limit must use a stable KV key prefix"
  ],
  [
    plannerRoutes,
    "limit: 20",
    "Planner generate rate limit must match provider policy"
  ],
  [
    routeRoutes,
    'routeRoutes.use("/optimize", rateLimit({',
    "Route optimize endpoint must install rate limiting before route computation"
  ],
  [
    routeRoutes,
    'keyPrefix: "routes_optimize"',
    "Route optimize rate limit must use a stable KV key prefix"
  ],
  [
    routeRoutes,
    "limit: 30",
    "Route optimize rate limit must match provider policy"
  ],
  [
    tripRoutes,
    'tripRoutes.use("/:tripId/exports", rateLimit({',
    "Trip export creation must install rate limiting before export asset creation"
  ],
  [
    tripRoutes,
    'keyPrefix: "trip_exports"',
    "Trip export rate limit must use a stable KV key prefix"
  ],
  [
    tripRoutes,
    "limit: 20",
    "Trip export rate limit must match provider policy"
  ],
  [
    tripRoutes,
    "windowSeconds: 3600",
    "Trip export rate limit window must match provider policy"
  ],
  [
    rateLimitMiddleware,
    'c.header("x-ratelimit-limit"',
    "Rate limit responses must include limit headers"
  ],
  [
    rateLimitMiddleware,
    'c.header("x-ratelimit-remaining"',
    "Rate limit responses must include remaining headers"
  ],
  [
    rateLimitMiddleware,
    'c.header("x-ratelimit-reset"',
    "Rate limit responses must include reset headers"
  ],
  [
    rateLimitMiddleware,
    '"RATE_LIMITED"',
    "Rate limit middleware must return a stable error code"
  ]
];

for (const [content, expectedText, label] of rateLimitContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing rate limit contract: ${label}`);
  }
}

const routeCacheContracts = [
  [
    routeCacheDb,
    "ROUTE_CACHE_TTL_HOURS = 6",
    "Route cache helper must define a bounded TTL"
  ],
  [
    routeCacheDb,
    "createRouteCacheKey",
    "Route cache helper must expose stable cache key creation"
  ],
  [
    routeCacheDb,
    "crypto.subtle.digest(\"SHA-256\"",
    "Route cache keys must be hashed instead of storing raw coordinate payloads in the key"
  ],
  [
    routeCacheDb,
    "getCachedRoute",
    "Route cache helper must expose cache reads"
  ],
  [
    routeCacheDb,
    "upsertRouteCache",
    "Route cache helper must expose cache writes"
  ],
  [
    routeRoutes,
    "const cachedProviderRoute = await getFirstCachedProviderRoute(c.env.DB, selectedMode, points, providerScopes);",
    "Route optimize must read from route_cache before computing"
  ],
  [
    routeRoutes,
    "await upsertRouteCache(c.env.DB",
    "Route optimize must write computed route summaries to route_cache"
  ],
  [
    routeRoutes,
    'cacheStatus: "hit"',
    "Route optimize must expose cache hits"
  ],
  [
    routeRoutes,
    'cacheStatus: cachedFallbackRoute ? "hit" : "miss"',
    "Route optimize must expose cache misses"
  ],
  [
    workerSmokeScript,
    "route optimize should return cacheStatus hit on repeated request",
    "Worker smoke must verify route cache hit behavior"
  ]
];

for (const [content, expectedText, label] of routeCacheContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing route cache contract: ${label}`);
  }
}

const mobileRouteProviderContracts = [
  [
    routeApi,
    "RouteCacheStatus",
    "Mobile route API must type route cache status"
  ],
  [
    routeApi,
    "cacheStatus?: RouteCacheStatus",
    "Mobile optimized route must preserve Worker cache status"
  ],
  [
    routeApi,
    "normalizeWorkerRoute(payload?.route, payload?.cacheStatus)",
    "Mobile route API must read cacheStatus from route optimize responses"
  ],
  [
    routeMapScreen,
    "cacheStatusLabel",
    "Route map screen must expose provider cache status in user-facing copy"
  ],
  [
    routeMapScreen,
    "네이버 길찾기",
    "Route map source labels must include Naver provider copy"
  ],
  [
    routeMapScreen,
    "네이버 실시간 경로 계산이 불안정해 대체 경로로 표시했어요.",
    "Route map warning copy must identify Naver provider failures"
  ],
  [
    routeMapScreen,
    "카카오 길찾기",
    "Route map source labels must include Kakao provider copy"
  ],
  [
    scheduleScreen,
    "routeProviderLabel",
    "Schedule timeline must map raw provider codes to user-facing labels"
  ],
  [
    scheduleScreen,
    "카카오 경로",
    "Schedule timeline must show Kakao provider as user-facing copy"
  ],
  [
    scheduleScreen,
    "예상 이동",
    "Schedule timeline must label fallback provider as expected movement"
  ]
];

for (const [content, expectedText, label] of mobileRouteProviderContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing mobile route provider contract: ${label}`);
  }
}

const sponsoredPlaceContracts = [
  [
    sponsoredPlacesDb,
    "applySponsoredPlaces",
    "Worker must expose sponsored place application helper"
  ],
  [
    sponsoredPlacesDb,
    "listSponsoredPlaces",
    "Worker must expose sponsored place listing helper for ops"
  ],
  [
    sponsoredPlacesDb,
    "upsertSponsoredPlace",
    "Worker must expose sponsored place upsert helper for ops"
  ],
  [
    sponsoredPlacesDb,
    "deactivateSponsoredPlace",
    "Worker must expose sponsored place deactivation helper for ops"
  ],
  [
    sponsoredPlacesDb,
    "FROM sponsored_places",
    "Sponsored place helper must read active campaigns from D1"
  ],
  [
    sponsoredPlacesDb,
    "starts_at IS NULL OR starts_at <= datetime('now')",
    "Sponsored place helper must respect campaign start time"
  ],
  [
    sponsoredPlacesDb,
    "ends_at IS NULL OR ends_at > datetime('now')",
    "Sponsored place helper must respect campaign end time"
  ],
  [
    sponsoredPlacesDb,
    "isSponsored: true",
    "Sponsored place helper must mark matched places as sponsored"
  ],
  [
    sponsoredPlacesDb,
    "sponsorLabel: disclosureLabel(sponsor)",
    "Sponsored place helper must apply explicit disclosure labels"
  ],
  [
    placeRoutes,
    "applySponsoredPlaces(c.env.DB, result.places)",
    "Place search route must apply sponsored disclosures before saving or returning results"
  ],
  [
    placeRoutes,
    "sponsoredCount",
    "Place search operational events must count sponsored results"
  ],
  [
    operationsDb,
    '"sponsoredCount"',
    "Operational event metadata allowlist must include sponsored result counts"
  ],
  [
    opsRoutes,
    "upsertSponsoredPlace(c.env.DB",
    "Ops routes must create or update sponsored place campaigns through DB helpers"
  ],
  [
    opsRoutes,
    "deactivateSponsoredPlace(c.env.DB",
    "Ops routes must deactivate sponsored place campaigns without hard deletion"
  ],
  [
    opsRoutes,
    'action: "ops.sponsored_places.create"',
    "Ops sponsored place creation must write an audit log"
  ],
  [
    opsRoutes,
    'action: "ops.sponsored_places.delete"',
    "Ops sponsored place deactivation must write an audit log"
  ],
  [
    workerSmokeScript,
    "ops sponsored place campaign",
    "Worker smoke must cover ops sponsored place campaign lifecycle when ops token is provided"
  ]
];

for (const [content, expectedText, label] of sponsoredPlaceContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing sponsored place contract: ${label}`);
  }
}

const workerCorsContracts = [
  [
    indexRoutes,
    'return c.env.ENVIRONMENT === "local" ? origin : "";',
    "Worker CORS empty allowlist fallback must be local-only"
  ],
  [
    indexRoutes,
    "return allowed.includes(origin) ? origin : \"\";",
    "Worker CORS must require explicit origin membership when allowlist is configured"
  ]
];

for (const [content, expectedText, label] of workerCorsContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing Worker CORS contract: ${label}`);
  }
}

if (indexRoutes.includes("if (!origin || allowed.length === 0)")) {
  errors.push("Worker CORS must not allow every origin when ALLOWED_ORIGINS is empty.");
}

for (const text of [
  "Placeholder trip-day and trip-place mutation endpoints",
  "must be completed before app-store release"
]) {
  if (cloudflareDeploymentDoc.includes(text)) {
    errors.push(`Cloudflare deployment docs contain stale Worker endpoint placeholder wording: ${text}`);
  }
}

for (const text of [
  "trip-day mutations",
  "trip-place mutations",
  "export preparation/downloads",
  "operations endpoints"
]) {
  if (!cloudflareDeploymentDoc.includes(text)) {
    errors.push(`Cloudflare deployment docs must describe current Worker endpoint scope: ${text}`);
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

const mobileInfoPlist = mobileAppJson.expo?.ios?.infoPlist ?? {};
const androidPermissions = mobileAppJson.expo?.android?.permissions ?? [];

if (!mobileInfoPlist.NSLocationWhenInUseUsageDescription) {
  errors.push("Mobile app must include an iOS when-in-use location permission explanation.");
}

if ("NSLocationAlwaysUsageDescription" in mobileInfoPlist) {
  errors.push("Mobile app must not request iOS Always location permission before a background-location feature exists.");
}

if (androidPermissions.includes("ACCESS_BACKGROUND_LOCATION")) {
  errors.push("Mobile app must not request Android background location permission before a background-location feature exists.");
}

const exportDownloadContracts = [
  [
    tripRoutes,
    'tripRoutes.get("/:tripId/exports/:exportId/download"',
    "Worker must expose owned export download endpoint"
  ],
  [
    tripRoutes,
    'shareRoutes.get("/:shareId/exports/:exportId/download"',
    "Worker must expose shared export download endpoint"
  ],
  [
    tripRoutes,
    "getOwnedTripExport(",
    "Export download must enforce trip export ownership"
  ],
  [
    tripRoutes,
    "getSharedTripExport(",
    "Shared export download must enforce active share token access"
  ],
  [
    tripRoutes,
    "listSharedTripExports(c.env.DB, shareId)",
    "Public share API must list ready shared exports for the active share token"
  ],
  [
    tripRoutes,
    "toPublicTripExport(record, null)",
    "Public share API must not return bearer-token export download URLs in JSON"
  ],
  [
    sharePageRoutes,
    "listSharedTripExports(c.env.DB, shareId)",
    "Public share page must list ready shared exports for the active share token"
  ],
  [
    sharePageRoutes,
    "공유된 일정 파일",
    "Public share page must render a shared export section when exports exist"
  ],
  [
    sharePageRoutes,
    "/api/v1/share/${encodeURIComponent(shareId)}/exports/${encodeURIComponent(record.id)}/download",
    "Public share page must link exports through the shared download endpoint"
  ],
  [
    tripExportsDb,
    "INNER JOIN share_links s",
    "Shared export lookup must join exports through share links"
  ],
  [
    tripExportsDb,
    "s.status = 'active'",
    "Shared export lookup must require an active share link"
  ],
  [
    tripExportsDb,
    "e.expires_at IS NULL OR e.expires_at > datetime('now')",
    "Shared export lookup must reject expired export assets"
  ],
  [
    tripExportsDb,
    "ORDER BY e.created_at DESC",
    "Shared export listing must return newest ready exports first"
  ],
  [
    tripRoutes,
    'headers.set("cache-control", "private, max-age=300")',
    "Export downloads must use private cache headers"
  ],
  [
    tripRoutes,
    'headers.set("cache-control", "private, no-store")',
    "Shared export downloads must prevent caching"
  ],
  [
    tripRoutes,
    'headers.set("x-robots-tag", "noindex, nofollow")',
    "Shared export downloads must prevent indexing"
  ],
  [
    tripRoutes,
    "buildExportDownloadUrl(c, tripId, exportRecord.id)",
    "Export creation must return owned download URL for ready assets"
  ],
  [
    tripRoutes,
    "renderPdfTripExport",
    "PDF export must generate a binary PDF asset"
  ],
  [
    tripRoutes,
    "const pages: Array",
    "PDF export must support multiple pages for longer itineraries"
  ],
  [
    tripRoutes,
    "/Count ${pages.length}",
    "PDF pages object must reflect the generated page count"
  ],
  [
    tripRoutes,
    'contentType: "application/pdf"',
    "PDF export asset must use application/pdf content type"
  ],
  [
    tripRoutes,
    'filename="tripmate-export-${exportId}.pdf"',
    "PDF export asset must use a PDF filename"
  ],
  [
    tripRoutes,
    "renderImageTripExport",
    "Image export must generate an R2 SVG asset"
  ],
  [
    tripRoutes,
    'contentType: "image/svg+xml; charset=utf-8"',
    "Image export asset must use SVG content type"
  ],
  [
    tripRoutes,
    'status: "ready"',
    "Worker export creation must mark generated PDF and image assets ready"
  ],
  [
    workerSmokeScript,
    "premium trip export",
    "Worker smoke must exercise premium export creation"
  ],
  [
    workerSmokeScript,
    "premium PDF export should return owned download URL",
    "Worker smoke must verify owned premium export download URL"
  ],
  [
    workerSmokeScript,
    "premium export download should be private",
    "Worker smoke must verify private export download cache headers"
  ],
  [
    workerSmokeScript,
    "premium export download should return binary TripMate PDF content",
    "Worker smoke must verify binary premium PDF content"
  ],
  [
    workerSmokeScript,
    "long export fixture should sync enough places for multi-page PDF",
    "Worker smoke must create enough itinerary places to exercise multi-page PDF exports"
  ],
  [
    workerSmokeScript,
    "premium export download should contain a multi-page PDF page count",
    "Worker smoke must verify owned PDF exports render multiple pages for long itineraries"
  ],
  [
    workerSmokeScript,
    "shared export download should return binary TripMate PDF content",
    "Worker smoke must verify binary shared PDF content"
  ],
  [
    workerSmokeScript,
    "shared export download should contain a multi-page PDF page count",
    "Worker smoke must verify shared PDF exports render multiple pages for long itineraries"
  ],
  [
    workerSmokeScript,
    "shared export download should prevent caching",
    "Worker smoke must verify shared export no-store headers"
  ],
  [
    workerSmokeScript,
    "shared export download should prevent indexing",
    "Worker smoke must verify shared export noindex headers"
  ],
  [
    workerSmokeScript,
    "public share read should list ready exports without echoing bearer token URLs",
    "Worker smoke must verify shared exports are discoverable from the share API without token URLs"
  ],
  [
    workerSmokeScript,
    "public share read should not echo bearer token through export metadata",
    "Worker smoke must verify shared export metadata does not echo the share token"
  ],
  [
    workerSmokeScript,
    "public share page should render ready shared export links",
    "Worker smoke must verify shared export links are rendered on the share page"
  ],
  [
    workerSmokeScript,
    "premium image export should be ready immediately",
    "Worker smoke must verify premium image exports are ready"
  ],
  [
    workerSmokeScript,
    "premium image export download should return SVG",
    "Worker smoke must verify premium image export download content type"
  ],
  [
    workerSmokeScript,
    "DELETE /api/v1/auth/me",
    "Worker smoke cleanup must delete the smoke account and owned R2 export objects"
  ]
];

for (const staleText of [
  "binary PDF/image rendering workers"
]) {
  if (apiWorkerReadme.includes(staleText)) {
    errors.push(`API Worker README contains stale export implementation wording: ${staleText}`);
  }
}

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

const mobileShareUrlPrivacyContracts = [
  [
    scheduleScreen,
    "브라우저 클립보드 권한이 없어 복사하지 못했어요",
    "Schedule share fallback must not render bearer share URLs"
  ],
  [
    profileScreen,
    "브라우저 클립보드 권한이 없어 복사하지 못했어요",
    "Profile share fallback must not render bearer share URLs"
  ]
];

for (const [content, expectedText, label] of mobileShareUrlPrivacyContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing mobile share URL privacy contract: ${label}`);
  }
}

for (const [content, label] of [
  [scheduleScreen, "Schedule share notice"],
  [profileScreen, "Profile share notice"]
]) {
  if (content.includes("공유 링크가 생성됐어요:")) {
    errors.push(`${label} must not render bearer share URLs in user-visible fallback copy.`);
  }
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

const mobileSearchStateContracts = [
  [
    searchScreen,
    "providerLabel",
    "Search screen must map raw provider codes to user-facing labels"
  ],
  [
    searchScreen,
    "네이버 장소",
    "Search screen must show Naver as user-facing provider copy"
  ],
  [
    searchScreen,
    "카카오 장소",
    "Search screen must show Kakao as user-facing provider copy"
  ],
  [
    searchScreen,
    "공공 관광",
    "Search screen must show Tour API as user-facing provider copy"
  ],
  [
    searchScreen,
    "searchErrorMessage",
    "Search screen must track provider/API failure separately from empty results"
  ],
  [
    searchScreen,
    "검색 결과가 없어요",
    "Search screen must show a true empty-result state"
  ],
  [
    searchScreen,
    "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
    "Search screen must show an actionable provider/API failure state"
  ],
  [
    searchScreen,
    "검색어를 바꾸거나 다른 카테고리를 선택해 주세요.",
    "Search screen must guide users when a successful query has no results"
  ],
  [
    searchScreen,
    "searchErrorMessage ? (",
    "Search screen retry CTA must be limited to provider/API failure state"
  ]
];

for (const [content, expectedText, label] of mobileSearchStateContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing mobile search state contract: ${label}`);
  }
}

if (searchScreen.includes("{place.provider}</Text>")) {
  errors.push("Search screen must not render raw provider codes directly.");
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
    workerSmokeScript,
    "place patch should persist memo",
    "Worker smoke must verify schedule place memo persistence"
  ],
  [
    workerSmokeScript,
    "place patch should clear memo with null",
    "Worker smoke must verify schedule place memo clearing"
  ],
  [
    workerSmokeScript,
    "place field clear should persist startTime null",
    "Worker smoke must verify schedule place time clearing persistence"
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
    'tripsApi.createExport(tripId, "image")',
    "Schedule premium image export must use the Worker export endpoint for saved trips"
  ],
  [
    scheduleScreen,
    "이미지 내보내기 파일을 열었어요.",
    "Schedule premium image export must surface successful Worker image export copy"
  ],
  [
    scheduleScreen,
    "openPreparedExport",
    "Schedule PDF and image exports must share authenticated download URL handling"
  ],
  [
    scheduleScreen,
    "PDF 파일을 열었어요.",
    "Schedule PDF export copy must refer to the generated PDF file"
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

const entitlementVerificationContracts = [
  [
    monetizationRoutes,
    "manual_entitlements_disabled_in_production",
    "Worker must disable manual entitlement activation in production"
  ],
  [
    monetizationRoutes,
    "manual_entitlement_allowed_outside_production",
    "Worker must mark manual entitlement activation as non-production only"
  ],
  [
    monetizationRoutes,
    "live_store_validation_not_yet_implemented",
    "Worker must keep store entitlements pending until live validation is implemented"
  ],
  [
    monetizationRoutes,
    'premium: entitlement.status === "active"',
    "Entitlement verify response must derive premium only from persisted active status"
  ],
  [
    monetizationRoutes,
    'canUnlockPremium: entitlement.status === "active"',
    "Entitlement verify response must expose explicit premium unlock state from persisted status"
  ],
  [
    monetizationRoutes,
    'verificationRequired: verification.verificationMode !== "manual-non-production"',
    "Entitlement verify response must expose whether store validation is still required"
  ],
  [
    workerSmokeScript,
    "store entitlement should remain pending until live validation is implemented",
    "Worker smoke must verify store entitlement requests remain pending before live validation"
  ],
  [
    workerSmokeScript,
    "store entitlement should explicitly require live validation before premium unlock",
    "Worker smoke must verify store entitlement responses expose validation-required state"
  ],
  [
    workerSmokeScript,
    "manual entitlement smoke should only activate through the non-production verification mode",
    "Worker smoke must verify manual active entitlement is non-production only"
  ],
  [
    workerSmokeScript,
    "manual non-production entitlement smoke should explicitly allow premium unlock without store verification",
    "Worker smoke must verify manual non-production entitlement responses do not require store validation"
  ],
  [
    mobileIap,
    "submitStoreVerification",
    "Mobile IAP service must expose a store receipt or transaction submission boundary"
  ],
  [
    mobileIap,
    "readIapIntegrationStatus",
    "Mobile IAP service must read the public IAP integration status"
  ],
  [
    mobileIap,
    "EXPO_PUBLIC_IAP_STATUS",
    "Mobile IAP service must use EXPO_PUBLIC_IAP_STATUS as the SDK readiness boundary"
  ],
  [
    mobileIap,
    "현재 빌드는 스토어 결제 SDK가 비활성화",
    "Mobile IAP service must not present disabled SDK builds as purchasable"
  ],
  [
    mobileIap,
    "storeVerificationMessage",
    "Mobile IAP service must map Worker verification reasons to user-safe copy"
  ],
  [
    mobileIap,
    "live_store_validation_not_yet_implemented",
    "Mobile IAP service must clearly explain pending status before live store validation"
  ],
  [
    mobileIap,
    "store_validation_secret_missing",
    "Mobile IAP service must explain server store validation setup gaps"
  ],
  [
    profileScreen,
    "스토어 구매 검증",
    "Mobile profile must expose store purchase verification UI"
  ],
  [
    profileScreen,
    "storeVerificationInput",
    "Mobile profile must keep store verification input transient in component state"
  ],
  [
    profileScreen,
    "storeVerificationPayload",
    "Mobile profile must submit store transaction data through the IAP service boundary"
  ],
  [
    profileScreen,
    "{ receipt: token }",
    "Mobile profile must support receipt-shaped store verification submissions"
  ],
  [
    profileScreen,
    "서버 검증 전에는 권한이 대기 상태로만 저장됩니다.",
    "Mobile store verification UI must explain pending status before live validation"
  ]
];

for (const [content, expectedText, label] of entitlementVerificationContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing entitlement verification contract: ${label}`);
  }
}

const mobileAuthPrivacyContracts = [
  [
    authProvider,
    "saveGuestProfile: (profile: UserSignupProfile) => Promise<void>;",
    "Mobile AuthProvider must expose a guest profile save path separate from authenticated sessions"
  ],
  [
    authProvider,
    "setStatus(\"unauthenticated\");",
    "Mobile guest profile save must not mark the user as authenticated"
  ],
  [
    profileSetupScreen,
    "await saveGuestProfile(userData);",
    "Mobile profile setup must save guest profile data without minting local auth tokens"
  ],
  [
    loginScreen,
    "로그인 없이 둘러보기",
    "Mobile login screen must expose guest mode instead of unsupported email login"
  ],
  [
    signupScreen,
    "게스트 프로필 만들기",
    "Mobile signup route must be positioned as guest profile setup until email auth exists"
  ],
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

for (const text of ["signup_auth_", "signup_access_", "signup_refresh_", "setSession({"]) {
  if (profileSetupScreen.includes(text)) {
    errors.push(`Mobile profile setup must not mint fake signup auth tokens: ${text}`);
  }
}

for (const [content, label] of [
  [loginScreen, "Mobile login screen"],
  [signupScreen, "Mobile guest profile screen"]
]) {
  for (const text of ["비밀번호", "passwordConfirm", "isPassword"]) {
    if (content.includes(text)) {
      errors.push(`${label} must not collect password fields until email authentication is implemented: ${text}`);
    }
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
const mobileEasConfig = readText("apps/mobile/eas.json");
for (const key of [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_MAP_PROVIDER",
  "EXPO_PUBLIC_IAP_STATUS",
  "EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY",
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

for (const key of ["development", "preview", "production"]) {
  if (!mobileEasConfig.includes(`"${key}"`)) {
    errors.push(`Missing EAS mobile build profile: ${key}`);
  }
}

for (const key of ["EXPO_PUBLIC_API_BASE_URL", "EXPO_PUBLIC_MAP_PROVIDER", "EXPO_PUBLIC_IAP_STATUS"]) {
  if (!mobileEasConfig.includes(key)) {
    errors.push(`Missing EAS public env key: ${key}`);
  }
}

if (!devReadinessCheck.includes('!key.startsWith("EXPO_PUBLIC_")')) {
  errors.push("dev-readiness-check must reject non-EXPO_PUBLIC keys in mobile runtime env files.");
}

if (!devReadinessCheck.includes("EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY")) {
  errors.push("dev-readiness-check must warn when Kakao web map rendering key is missing.");
}

for (const text of [
  "Node.js v25+ is not a supported TripMate mobile visual QA runtime",
  "ERR_SOCKET_BAD_PORT",
  "npm run mobile:web:qa"
]) {
  if (!devReadinessCheck.includes(text)) {
    errors.push(`dev-readiness-check must flag Expo web Node 25 visual QA blockers: ${text}`);
  }
}

for (const text of [
  "listMobileRuntimeEnvFiles",
  "entry === \".env\" || entry.startsWith(\".env.\")",
  "!entry.endsWith(\".example\")",
  "checkMobileEnvFile(filePath)"
]) {
  if (!devReadinessCheck.includes(text)) {
    errors.push(`dev-readiness-check must scan all mobile runtime env variants: ${text}`);
  }
}

for (const text of [
  "collectEasEnvObjects",
  "checkMobilePublicEnvMap",
  "apps/mobile/eas.json",
  "EAS env keys must start with EXPO_PUBLIC_",
  "EAS ${checkTarget} EXPO_PUBLIC_API_BASE_URL must point to a real ${checkTarget} Worker URL",
  "EAS ${checkTarget} Kakao map provider requires EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY",
  "EAS ${checkTarget} EXPO_PUBLIC_IAP_STATUS must be sdk-configured before release builds"
]) {
  if (!devReadinessCheck.includes(text)) {
    errors.push(`dev-readiness-check must validate EAS mobile env boundaries: ${text}`);
  }
}

for (const text of [
  "extractTomlVarsBlocks",
  "serverOnlyWorkerSecretKeys",
  "must not be stored in services/api-worker/wrangler.toml"
]) {
  if (!devReadinessCheck.includes(text)) {
    errors.push(`dev-readiness-check must reject Worker secrets in wrangler vars: ${text}`);
  }
}

for (const text of [
  "constantTimeTokenEquals",
  "actual.length ^ expected.length",
  "!constantTimeTokenEquals(adminToken(c), expectedToken)"
]) {
  if (!opsRoutes.includes(text)) {
    errors.push(`Ops routes must compare admin tokens with the hardened helper: ${text}`);
  }
}

for (const text of [
  "assertDeployAllowedOrigins",
  "ALLOWED_ORIGINS must explicitly list browser origins",
  "ALLOWED_ORIGINS must not contain localhost or 127.0.0.1 for deploy readiness",
  "ALLOWED_ORIGINS must use HTTPS browser origins"
]) {
  if (!devReadinessCheck.includes(text)) {
    errors.push(`dev-readiness-check must validate deploy CORS origins: ${text}`);
  }
}

for (const text of [
  "wrangler",
  "secret",
  "list",
  "exec\", \"--\", \"wrangler",
  "--json",
  "--print-required",
  "--print-recommended",
  "recommendedSecrets",
  "Missing Cloudflare production split Naver secret",
  "target === \"production\"",
  "NAVER_SEARCH_CLIENT_ID",
  "NAVER_SEARCH_CLIENT_SECRET",
  "NAVER_MAPS_CLIENT_ID",
  "NAVER_MAPS_CLIENT_SECRET",
  "Missing Cloudflare ${target} secret",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
  "NAVER_SEARCH_CLIENT_ID",
  "NAVER_SEARCH_CLIENT_SECRET",
  "NAVER_MAPS_CLIENT_ID",
  "NAVER_MAPS_CLIENT_SECRET",
  "KAKAO_REST_API_KEY",
  "DATA_GO_KR_API_KEY",
  "ODSAY_API_KEY",
  "APPLE_SHARED_SECRET",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "OPS_ADMIN_TOKEN"
]) {
  if (!cloudflareSecretsCheck.includes(text)) {
    errors.push(`Cloudflare secret check must verify required secret names without values: ${text}`);
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
  "worker:smoke:naver",
  "TRIPMATE_KAKAO_ACCESS_TOKEN",
  "/api/v1/ops/retention",
  "Do not run this write smoke against production"
]) {
  requireText("docs/deployment-cloudflare.md", text);
}

if (!apiWorkerReadme.includes("TRIPMATE_KAKAO_ACCESS_TOKEN")) {
  errors.push("API Worker README must document the optional live Kakao auth smoke token.");
}

for (const text of [
  "npm run worker:smoke:naver -- --base-url",
  "live strict provider smoke evidence from a configured preview Worker"
]) {
  if (!apiWorkerReadme.includes(text) && !cloudflareDeploymentDoc.includes(text)) {
    errors.push(`Missing strict provider smoke operations contract: ${text}`);
  }
}

if (packageJson.scripts?.["worker:smoke:naver"] !== "node scripts/worker-v1-smoke.mjs --require-provider naver") {
  errors.push("Missing strict provider smoke root script: worker:smoke:naver");
}

if (apiWorkerReadme.includes("production Cloudflare secrets")) {
  errors.push("API Worker README must not describe live provider smoke as a production-secret operation.");
}

for (const text of [
  "npm ci",
  "npm run check:env",
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
  "require_provider",
  "TRIPMATE_WORKER_BASE_URL",
  "TRIPMATE_REQUIRE_PROVIDER",
  "TRIPMATE_KAKAO_ACCESS_TOKEN",
  "OPS_ADMIN_TOKEN",
  "node --check scripts/worker-v1-smoke.mjs",
  "--require-provider",
  "--kakao-access-token",
  "args=(--base-url",
  'npm run worker:smoke -- "${args[@]}"'
]) {
  if (!previewSmokeWorkflow.includes(text)) {
    errors.push(`Missing preview smoke workflow contract: ${text}`);
  }
}

for (const text of [
  "dayNumber auto-link",
  "dayNumber-only place create should auto-link a trip day",
  "places geocode contract",
  "--require-provider",
  "TRIPMATE_REQUIRE_PROVIDER",
  "places search should include required provider results",
  "planner generate should return required provider route summary",
  "planner replan should return required provider route summary",
  "route optimize should return required provider route",
  "cached route optimize should return required provider route",
  "GET /api/v1/places/geocode",
  "GET /api/v1/places/reverse-geocode",
  "geocode should return null or numeric coordinates",
  "geocode should return required provider coordinates",
  "reverse geocode should return null or an address string",
  "reverse geocode should return required provider address",
  "free saved trip limit",
  "FREE_TRIP_LIMIT_REACHED",
  "--kakao-access-token",
  "TRIPMATE_KAKAO_ACCESS_TOKEN",
  "live kakao login and logout",
  "live Kakao login should return Kakao provider user",
  "POST /api/v1/auth/logout after live Kakao login",
  "ops retention dry run",
  "/api/v1/ops/retention?dryRun=true"
]) {
  if (!workerSmokeScript.includes(text)) {
    errors.push(`Missing Worker smoke day auto-link assertion: ${text}`);
  }
}

const workerJwtSecretContracts = [
  [
    workerTokens,
    'if (env.ENVIRONMENT === "local")',
    "Worker JWT fallback secrets must be local-only"
  ],
  [
    workerTokens,
    "Missing JWT_${kind.toUpperCase()}_SECRET.",
    "Worker JWT secret failure must be explicit when non-local secrets are missing"
  ]
];

for (const [content, expectedText, label] of workerJwtSecretContracts) {
  if (!content.includes(expectedText)) {
    errors.push(`Missing Worker JWT secret contract: ${label}`);
  }
}

if (workerTokens.includes('env.ENVIRONMENT === "preview"')) {
  errors.push("Worker JWT fallback secrets must not be allowed in preview.");
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
