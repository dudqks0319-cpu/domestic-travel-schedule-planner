#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

function readArg(name, fallback = "") {
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

function hasFlag(name) {
  return process.argv.includes(name);
}

function printHelp() {
  console.log(`TripMate production release gate

Usage:
  npm run release:production:gate -- --base-url https://<production-worker>

Required:
  --base-url          Deployed production Worker URL. The gate refuses localhost,
                      preview, example, and placeholder URLs.

The gate runs, in order:
  1. npm run check:env:production
  2. npm run check:secrets:production
  3. npm run d1:check:production
  4. npm run check:release-contract
  5. npm test
  6. npm run check:health
  7. Read-only health checks against /health and /api/v1/health

No production write smoke is run by this gate.
`);
}

if (hasFlag("--help") || hasFlag("-h")) {
  printHelp();
  process.exit(0);
}

const baseUrl = readArg("--base-url", process.env.TRIPMATE_PRODUCTION_WORKER_URL ?? "")
  .replace(/\/+$/, "");

if (!baseUrl) {
  console.error("[release:production:gate] ERROR: --base-url or TRIPMATE_PRODUCTION_WORKER_URL is required.");
  process.exit(1);
}

if (/localhost|127\.0\.0\.1|example|preview|REPLACE_WITH/i.test(baseUrl)) {
  console.error("[release:production:gate] ERROR: --base-url must be a real deployed production Worker URL.");
  process.exit(1);
}

function runCommand(label, command, args) {
  console.log(`\n[release:production:gate] ${label}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}

async function readHealthJson(pathname) {
  const url = `${baseUrl}${pathname}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  const body = await response.json().catch(() => null);
  if (!body || body.ok !== true || body.service !== "tripmate-api-worker") {
    throw new Error(`${url} returned an invalid TripMate health payload`);
  }

  if (body.environment !== "production") {
    throw new Error(`${url} reported ENVIRONMENT=${body.environment}; expected production`);
  }

  console.log(`[release:production:gate] health ok: ${url}`);
}

async function verifyProductionHealth(productionBaseUrl) {
  if (productionBaseUrl !== baseUrl) {
    throw new Error("production health base URL changed during gate execution");
  }

  await readHealthJson("/health");
  await readHealthJson("/api/v1/health");
}

async function main() {
  await runCommand("check production env readiness", npmBin, ["run", "check:env:production"]);
  await runCommand("check production Cloudflare secret names", npmBin, ["run", "check:secrets:production"]);
  await runCommand("check production D1 migrations", npmBin, ["run", "d1:check:production"]);
  await runCommand("check release contract", npmBin, ["run", "check:release-contract"]);
  await runCommand("run planner tests", npmBin, ["test"]);
  await runCommand("run build/typecheck health gate", npmBin, ["run", "check:health"]);
  await verifyProductionHealth(baseUrl);

  console.log(`\n[release:production:gate] passed: ${baseUrl}`);
}

main().catch((error) => {
  console.error(`\n[release:production:gate] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
