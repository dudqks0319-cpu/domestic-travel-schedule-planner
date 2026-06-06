import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const allowedTargets = new Set(["local", "preview", "production"]);

function readTarget() {
  const inline = process.argv.find((arg) => arg.startsWith("--target="));
  const targetFlagIndex = process.argv.indexOf("--target");
  const rawTarget = inline
    ? inline.slice("--target=".length)
    : targetFlagIndex >= 0
      ? process.argv[targetFlagIndex + 1]
      : undefined;
  const target = rawTarget || process.env.TRIPMATE_CHECK_TARGET || "local";

  if (!allowedTargets.has(target)) {
    return { target: "local", error: `Unsupported check target: ${target}. Use local, preview, or production.` };
  }

  return { target, error: null };
}

const { target: checkTarget, error: targetError } = readTarget();

function fromRoot(...parts) {
  return path.join(repoRoot, ...parts);
}

function parseEnvFile(filePath) {
  const values = new Map();
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const equalsIndex = normalized.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

function hasNonEmptyValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const errors = [];
const warnings = [];
if (targetError) {
  errors.push(targetError);
}

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
  errors.push(`Node.js >= 20 is required (current: ${process.version}).`);
}

const apiEnvPath = fromRoot("services", "api", ".env");
if (!fs.existsSync(apiEnvPath)) {
  warnings.push(
    "Missing services/api/.env. Copy services/api/.env.example to services/api/.env and set values."
  );
}

const apiRequiredKeys = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "DATA_GO_KR_API_KEY"
];
if (fs.existsSync(apiEnvPath)) {
  const apiEnv = parseEnvFile(apiEnvPath);

  for (const key of apiRequiredKeys) {
    if (!hasNonEmptyValue(apiEnv.get(key))) {
      errors.push(`Missing required key in services/api/.env: ${key}`);
    }
  }

  const weakSecretValues = new Set(["change-me", "change-me-too"]);
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    const value = apiEnv.get(key);
    if (hasNonEmptyValue(value) && weakSecretValues.has(value)) {
      warnings.push(`services/api/.env uses placeholder value for ${key}.`);
    }
  }
}

const mobileEnvPath = fromRoot("apps", "mobile", ".env");
const forbiddenMobileKeys = [
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
  "KAKAO_REST_API_KEY",
  "DATA_GO_KR_API_KEY",
  "ODSAY_API_KEY",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "APPLE_SHARED_SECRET",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "OPS_ADMIN_TOKEN"
];

function listMobileRuntimeEnvFiles() {
  const mobileDir = fromRoot("apps", "mobile");
  if (!fs.existsSync(mobileDir)) {
    return [];
  }

  return fs.readdirSync(mobileDir)
    .filter((entry) => entry === ".env" || entry.startsWith(".env."))
    .filter((entry) => !entry.endsWith(".example"))
    .map((entry) => path.join(mobileDir, entry));
}

function checkMobileEnvFile(filePath) {
  const label = path.relative(repoRoot, filePath);
  const mobileEnv = parseEnvFile(filePath);
  if (mobileEnv.has("EXPO_PUBLIC_API_BASE_URL") && !hasNonEmptyValue(mobileEnv.get("EXPO_PUBLIC_API_BASE_URL"))) {
    warnings.push(`${label} has empty EXPO_PUBLIC_API_BASE_URL.`);
  }

  if (
    mobileEnv.get("EXPO_PUBLIC_MAP_PROVIDER") === "kakao" &&
    !hasNonEmptyValue(mobileEnv.get("EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY"))
  ) {
    warnings.push(`${label} selects Kakao map provider without EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY for web map rendering.`);
  }

  for (const key of mobileEnv.keys()) {
    if (!key.startsWith("EXPO_PUBLIC_")) {
      errors.push(`Forbidden non-public key in ${label}: ${key}. Mobile env keys must start with EXPO_PUBLIC_.`);
    }
  }

  for (const key of forbiddenMobileKeys) {
    if (mobileEnv.has(key)) {
      errors.push(`Forbidden server-only key in ${label}: ${key}`);
    }
  }
}

const mobileRuntimeEnvFiles = listMobileRuntimeEnvFiles();
if (!fs.existsSync(mobileEnvPath)) {
  warnings.push(
    "apps/mobile/.env not found. Mobile app will use default Worker API base URL (http://localhost:8787/api/v1)."
  );
}

for (const filePath of mobileRuntimeEnvFiles) {
  checkMobileEnvFile(filePath);
}

function collectEasEnvObjects(value, pathParts = [], entries = []) {
  if (!value || typeof value !== "object") {
    return entries;
  }

  if (!Array.isArray(value) && value.env && typeof value.env === "object" && !Array.isArray(value.env)) {
    entries.push({
      label: `apps/mobile/eas.json:${pathParts.concat("env").join(".")}`,
      env: value.env
    });
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectEasEnvObjects(item, pathParts.concat(String(index)), entries));
  } else {
    for (const [key, child] of Object.entries(value)) {
      collectEasEnvObjects(child, pathParts.concat(key), entries);
    }
  }

  return entries;
}

function checkMobilePublicEnvMap(label, envMap) {
  if (typeof envMap.EXPO_PUBLIC_API_BASE_URL === "string" && !hasNonEmptyValue(envMap.EXPO_PUBLIC_API_BASE_URL)) {
    warnings.push(`${label} has empty EXPO_PUBLIC_API_BASE_URL.`);
  }

  if (
    envMap.EXPO_PUBLIC_MAP_PROVIDER === "kakao" &&
    !hasNonEmptyValue(envMap.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY)
  ) {
    warnings.push(`${label} selects Kakao map provider without EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY for web map rendering.`);
  }

  for (const key of Object.keys(envMap)) {
    if (!key.startsWith("EXPO_PUBLIC_")) {
      errors.push(`Forbidden non-public key in ${label}: ${key}. EAS env keys must start with EXPO_PUBLIC_.`);
    }
  }

  for (const key of forbiddenMobileKeys) {
    if (Object.prototype.hasOwnProperty.call(envMap, key)) {
      errors.push(`Forbidden server-only key in ${label}: ${key}`);
    }
  }
}

const easConfigPath = fromRoot("apps", "mobile", "eas.json");
if (!fs.existsSync(easConfigPath)) {
  warnings.push("Missing apps/mobile/eas.json. EAS build profiles should define only public EXPO_PUBLIC_* env values.");
} else {
  try {
    const easConfig = JSON.parse(fs.readFileSync(easConfigPath, "utf8"));
    for (const entry of collectEasEnvObjects(easConfig)) {
      checkMobilePublicEnvMap(entry.label, entry.env);
    }

    const targetBuildEnv = easConfig?.build?.[checkTarget]?.env;
    if (checkTarget === "preview" || checkTarget === "production") {
      if (!targetBuildEnv || typeof targetBuildEnv !== "object") {
        errors.push(`Missing EAS ${checkTarget} build env in apps/mobile/eas.json.`);
      } else {
        const apiBaseUrl = String(targetBuildEnv.EXPO_PUBLIC_API_BASE_URL ?? "");
        if (!apiBaseUrl || /REPLACE_WITH|localhost|127\.0\.0\.1|example/.test(apiBaseUrl)) {
          errors.push(`EAS ${checkTarget} EXPO_PUBLIC_API_BASE_URL must point to a real ${checkTarget} Worker URL.`);
        }

        if (
          targetBuildEnv.EXPO_PUBLIC_MAP_PROVIDER === "kakao" &&
          !hasNonEmptyValue(targetBuildEnv.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY)
        ) {
          errors.push(`EAS ${checkTarget} Kakao map provider requires EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY for web map rendering.`);
        }
      }
    } else {
      const serialized = JSON.stringify(easConfig);
      if (/REPLACE_WITH|tripmate\.example/.test(serialized)) {
        warnings.push("apps/mobile/eas.json still has preview/production placeholder public URLs. Run check:env with --target preview or --target production before release builds.");
      }
    }
  } catch (error) {
    errors.push(`Invalid apps/mobile/eas.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function cloudflareEnvBlock(content, target) {
  const marker = `[env.${target}]`;
  const start = content.indexOf(marker);
  if (start < 0) {
    return "";
  }

  const nextTopLevelEnv = target === "preview"
    ? content.indexOf("\n[env.production]", start + marker.length)
    : -1;
  return nextTopLevelEnv < 0 ? content.slice(start) : content.slice(start, nextTopLevelEnv);
}

function requireNoPlaceholder(content, label, keyPattern) {
  const match = content.match(keyPattern);
  if (!match) {
    errors.push(`Missing ${label} in services/api-worker/wrangler.toml.`);
    return;
  }

  const value = match[1]?.trim() ?? "";
  if (!value || value.includes("REPLACE_WITH")) {
    errors.push(`Cloudflare ${checkTarget} ${label} still uses a placeholder value.`);
  }
}

function extractTomlStringValue(content, key) {
  const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m"));
  return match?.[1]?.trim() ?? "";
}

function assertDeployAllowedOrigins(content) {
  const allowedOrigins = extractTomlStringValue(content, "ALLOWED_ORIGINS");
  if (!allowedOrigins) {
    errors.push(`Cloudflare ${checkTarget} ALLOWED_ORIGINS must explicitly list browser origins.`);
    return;
  }

  const origins = allowedOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    errors.push(`Cloudflare ${checkTarget} ALLOWED_ORIGINS must include at least one browser origin.`);
  }

  for (const origin of origins) {
    if (/REPLACE_WITH|example/.test(origin)) {
      errors.push(`Cloudflare ${checkTarget} ALLOWED_ORIGINS must not contain placeholder or example origins.`);
    }

    if (/localhost|127\.0\.0\.1/.test(origin)) {
      errors.push(`Cloudflare ${checkTarget} ALLOWED_ORIGINS must not contain localhost or 127.0.0.1 for deploy readiness.`);
    }

    if (!origin.startsWith("https://")) {
      errors.push(`Cloudflare ${checkTarget} ALLOWED_ORIGINS must use HTTPS browser origins: ${origin}`);
    }
  }
}

const serverOnlyWorkerSecretKeys = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
  "KAKAO_REST_API_KEY",
  "DATA_GO_KR_API_KEY",
  "ODSAY_API_KEY",
  "APPLE_SHARED_SECRET",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "OPS_ADMIN_TOKEN"
];

function extractTomlVarsBlocks(content) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const heading = line.trim().match(/^\[(.+)]$/);
    if (heading) {
      if (current) {
        blocks.push(current);
      }
      const sectionName = heading[1] ?? "";
      current = sectionName === "vars" || sectionName.endsWith(".vars")
        ? { sectionName, content: "" }
        : null;
      continue;
    }

    if (current) {
      current.content += `${line}\n`;
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

const wranglerPath = fromRoot("services", "api-worker", "wrangler.toml");
if (!fs.existsSync(wranglerPath)) {
  errors.push("Missing services/api-worker/wrangler.toml.");
} else {
  const wrangler = fs.readFileSync(wranglerPath, "utf8");
  const previewBlock = cloudflareEnvBlock(wrangler, "preview");
  const productionBlock = cloudflareEnvBlock(wrangler, "production");

  for (const block of extractTomlVarsBlocks(wrangler)) {
    for (const key of serverOnlyWorkerSecretKeys) {
      if (new RegExp(`^\\s*${key}\\s*=`, "m").test(block.content)) {
        errors.push(`Server-only secret ${key} must not be stored in services/api-worker/wrangler.toml [${block.sectionName}]. Use wrangler secret put instead.`);
      }
    }
  }

  if (checkTarget === "local") {
    if (/REPLACE_WITH_[A-Z0-9_]+/.test(previewBlock) || /REPLACE_WITH_[A-Z0-9_]+/.test(productionBlock)) {
      warnings.push(
        "services/api-worker/wrangler.toml still has preview/production placeholder IDs. Run check:env with --target preview or --target production before deploy."
      );
    }
  }

  if (checkTarget === "preview" || checkTarget === "production") {
    const targetBlock = checkTarget === "preview" ? previewBlock : productionBlock;
    if (!targetBlock) {
      errors.push(`Missing [env.${checkTarget}] in services/api-worker/wrangler.toml.`);
    } else {
      requireNoPlaceholder(targetBlock, "D1 database_id", /^\s*database_id\s*=\s*"([^"]+)"/m);
      requireNoPlaceholder(targetBlock, "KV namespace id", /^\s*id\s*=\s*"([^"]+)"/m);

      if (!/binding\s*=\s*"TRIPMATE_ASSETS"/.test(targetBlock)) {
        errors.push(`Cloudflare ${checkTarget} R2 binding TRIPMATE_ASSETS is missing.`);
      }

      if (!/bucket_name\s*=\s*"([^"]+)"/.test(targetBlock)) {
        errors.push(`Cloudflare ${checkTarget} R2 bucket_name is missing.`);
      }

      if (!new RegExp(`ENVIRONMENT\\s*=\\s*"${checkTarget}"`).test(targetBlock)) {
        errors.push(`Cloudflare ${checkTarget} ENVIRONMENT must be "${checkTarget}".`);
      }

      assertDeployAllowedOrigins(targetBlock);
    }
  }
}

for (const warning of warnings) {
  console.warn(`[check:env] WARN: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[check:env] ERROR: ${error}`);
  }
  process.exit(1);
}

console.log(`[check:env] Environment readiness looks good for target=${checkTarget}.`);
