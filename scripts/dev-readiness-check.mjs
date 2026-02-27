import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");

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

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
  errors.push(`Node.js >= 20 is required (current: ${process.version}).`);
}

const apiEnvPath = fromRoot("services", "api", ".env");
if (!fs.existsSync(apiEnvPath)) {
  errors.push(
    "Missing services/api/.env. Copy services/api/.env.example to services/api/.env and set values."
  );
}

const apiRequiredKeys = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
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
if (!fs.existsSync(mobileEnvPath)) {
  warnings.push(
    "apps/mobile/.env not found. Mobile app will use default API base URL (http://localhost:4000)."
  );
} else {
  const mobileEnv = parseEnvFile(mobileEnvPath);
  if (mobileEnv.has("EXPO_PUBLIC_API_BASE_URL") && !hasNonEmptyValue(mobileEnv.get("EXPO_PUBLIC_API_BASE_URL"))) {
    warnings.push("apps/mobile/.env has empty EXPO_PUBLIC_API_BASE_URL.");
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

console.log("[check:env] Environment readiness looks good.");
