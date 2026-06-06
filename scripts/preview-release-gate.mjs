#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const allowedProviders = new Set(["naver", "kakao", "none"]);

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
  console.log(`TripMate preview release gate

Usage:
  npm run release:preview:gate -- --base-url https://<preview-worker>
  npm run release:preview:gate -- --base-url https://<preview-worker> --ops-token "$OPS_ADMIN_TOKEN"
  npm run release:preview:gate -- --base-url https://<preview-worker> --require-provider kakao

Required:
  --base-url          Deployed preview Worker URL. The gate refuses to run write smoke without it.

Options:
  --require-provider  Strict provider smoke target: naver, kakao, or none. Default: naver.
  --ops-token         Optional ops token. It is passed to the smoke script through OPS_ADMIN_TOKEN,
                      not as a downstream command-line argument.

The gate runs, in order:
  1. npm run check:env:preview
  2. npm run check:secrets:preview
  3. npm run d1:check:preview
  4. npm run check:release-contract
  5. npm test
  6. npm run check:health
  7. npm run worker:smoke against the preview Worker with strict provider mode by default
`);
}

if (hasFlag("--help") || hasFlag("-h")) {
  printHelp();
  process.exit(0);
}

const baseUrl = readArg("--base-url", process.env.TRIPMATE_PREVIEW_WORKER_URL ?? "")
  .replace(/\/+$/, "");
const requiredProvider = readArg("--require-provider", process.env.TRIPMATE_REQUIRE_PROVIDER ?? "naver")
  .trim()
  .toLowerCase();
const opsToken = readArg("--ops-token", process.env.OPS_ADMIN_TOKEN ?? "");

if (!baseUrl) {
  console.error("[release:preview:gate] ERROR: --base-url or TRIPMATE_PREVIEW_WORKER_URL is required.");
  process.exit(1);
}

if (!allowedProviders.has(requiredProvider)) {
  console.error("[release:preview:gate] ERROR: --require-provider must be naver, kakao, or none.");
  process.exit(1);
}

if (/localhost|127\.0\.0\.1|example|REPLACE_WITH/i.test(baseUrl)) {
  console.error("[release:preview:gate] ERROR: --base-url must be a real deployed preview Worker URL.");
  process.exit(1);
}

function runCommand(label, command, args, options = {}) {
  console.log(`\n[release:preview:gate] ${label}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: options.env ?? process.env,
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

async function main() {
  await runCommand("check preview env readiness", npmBin, ["run", "check:env:preview"]);
  await runCommand("check preview Cloudflare secret names", npmBin, ["run", "check:secrets:preview"]);
  await runCommand("check preview D1 migrations", npmBin, ["run", "d1:check:preview"]);
  await runCommand("check release contract", npmBin, ["run", "check:release-contract"]);
  await runCommand("run planner tests", npmBin, ["test"]);
  await runCommand("run build/typecheck health gate", npmBin, ["run", "check:health"]);

  const smokeArgs = ["run", "worker:smoke", "--", "--base-url", baseUrl];
  if (requiredProvider !== "none") {
    smokeArgs.push("--require-provider", requiredProvider);
  }

  await runCommand("run preview Worker write smoke", npmBin, smokeArgs, {
    env: {
      ...process.env,
      ...(opsToken ? { OPS_ADMIN_TOKEN: opsToken } : {})
    }
  });

  console.log(`\n[release:preview:gate] passed: ${baseUrl}`);
}

main().catch((error) => {
  console.error(`\n[release:preview:gate] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
