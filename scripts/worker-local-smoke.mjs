#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "http://127.0.0.1:8787";
const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const workerRoot = path.join(repoRoot, "services", "api-worker");
const migrationsDir = path.join(workerRoot, "migrations");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const migrationLedgerTable = "schema_migrations";

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

function printHelp() {
  console.log(`TripMate local Worker smoke

Usage:
  npm run worker:smoke:local
  npm run worker:smoke:local -- --base-url http://127.0.0.1:8787

What it does:
  1. Applies pending local D1 migrations from services/api-worker/migrations in filename order.
  2. Verifies every discovered migration is recorded in local D1 schema_migrations.
  3. Starts wrangler dev --local through npm run worker:dev.
  4. Waits for /health.
  5. Runs npm run worker:smoke against the local Worker.
  6. Stops the local Worker process.
`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const baseUrl = readArg("--base-url", process.env.TRIPMATE_WORKER_BASE_URL ?? DEFAULT_BASE_URL)
  .replace(/\/+$/, "");
let workerProcess = null;

function runCommand(label, command, args, options = {}) {
  console.log(`\n[worker:smoke:local] ${label}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
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

function runCommandCapture(label, command, args, options = {}) {
  console.log(`\n[worker:smoke:local] ${label}`);

  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(output);
        return;
      }

      reject(new Error(`${label} failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}

async function hasUserProfileImageColumn() {
  const output = await runCommandCapture(
    "check local D1 users.profile_image column",
    npmBin,
    [
      "exec",
      "--",
      "wrangler",
      "d1",
      "execute",
      "tripmate-local",
      "--local",
      "--command=SELECT name FROM pragma_table_info('users') WHERE name = 'profile_image';"
    ],
    { cwd: workerRoot }
  );

  return output.includes('"name": "profile_image"');
}

async function ensureMigrationLedger() {
  await runCommand(
    `ensure local D1 ${migrationLedgerTable}`,
    npmBin,
    [
      "exec",
      "--",
      "wrangler",
      "d1",
      "execute",
      "tripmate-local",
      "--local",
      `--command=CREATE TABLE IF NOT EXISTS ${migrationLedgerTable} (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));`
    ],
    { cwd: workerRoot }
  );
}

async function listAppliedMigrations() {
  const output = await runCommandCapture(
    `read local D1 ${migrationLedgerTable}`,
    npmBin,
    [
      "exec",
      "--",
      "wrangler",
      "d1",
      "execute",
      "tripmate-local",
      "--local",
      `--command=SELECT name FROM ${migrationLedgerTable} ORDER BY name;`
    ],
    { cwd: workerRoot }
  );

  return new Set(Array.from(output.matchAll(/"name"\s*:\s*"([^"]+)"/g)).map((match) => match[1]));
}

async function recordMigration(migration) {
  const escapedMigration = migration.replaceAll("'", "''");
  await runCommand(
    `record local D1 migration ${migration}`,
    npmBin,
    [
      "exec",
      "--",
      "wrangler",
      "d1",
      "execute",
      "tripmate-local",
      "--local",
      `--command=INSERT OR IGNORE INTO ${migrationLedgerTable} (name) VALUES ('${escapedMigration}');`
    ],
    { cwd: workerRoot }
  );
}

function discoverMigrations() {
  const migrations = fs.readdirSync(migrationsDir)
    .filter((entry) => /^\d{4}_.+\.sql$/.test(entry))
    .sort((left, right) => left.localeCompare(right));

  if (migrations.length === 0) {
    throw new Error(`No D1 migrations found in ${migrationsDir}`);
  }

  return migrations;
}

async function applyMigrations() {
  await ensureMigrationLedger();
  const appliedMigrations = await listAppliedMigrations();

  for (const migration of discoverMigrations()) {
    if (appliedMigrations.has(migration)) {
      console.log(`[worker:smoke:local] skip already applied ${migration}`);
      continue;
    }

    if (migration === "0004_user_profile_image.sql" && await hasUserProfileImageColumn()) {
      console.log("[worker:smoke:local] skip 0004_user_profile_image.sql; users.profile_image already exists");
      await recordMigration(migration);
      continue;
    }

    await runCommand(
      `apply local D1 migration ${migration}`,
      npmBin,
      [
        "exec",
        "--",
        "wrangler",
        "d1",
        "execute",
        "tripmate-local",
        "--local",
        `--file=./migrations/${migration}`
      ],
      { cwd: workerRoot }
    );
    await recordMigration(migration);
  }
}

async function verifyMigrationLedger() {
  const migrations = discoverMigrations();
  const appliedMigrations = await listAppliedMigrations();
  const missingMigrations = migrations.filter((migration) => !appliedMigrations.has(migration));

  if (missingMigrations.length > 0) {
    throw new Error(`missing local D1 migration ledger entries: ${missingMigrations.join(", ")}`);
  }

  console.log(`[worker:smoke:local] verified local D1 migration ledger: ${migrations.length} migrations recorded`);
}

function startWorker() {
  console.log("\n[worker:smoke:local] start local Worker");

  const child = spawn(npmBin, ["run", "worker:dev"], {
    cwd: repoRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  workerProcess = child;

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  return child;
}

async function waitForWorker(worker) {
  let closed = false;
  let closeReason = "";
  worker.once("exit", (code, signal) => {
    closed = true;
    closeReason = signal ?? `exit code ${code}`;
  });

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (closed) {
      throw new Error(`local Worker exited before health check passed: ${closeReason}`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.environment === "local") {
          console.log(`[worker:smoke:local] health ok: ${baseUrl}/health`);
          return;
        }
      }
    } catch {
      // The dev server is still starting.
    }

    await delay(500);
  }

  throw new Error(`local Worker did not become healthy at ${baseUrl}/health`);
}

async function stopWorker() {
  if (!workerProcess || workerProcess.exitCode !== null) {
    return;
  }

  console.log("\n[worker:smoke:local] stop local Worker");
  workerProcess.kill("SIGINT");

  const stopped = await Promise.race([
    new Promise((resolve) => workerProcess.once("exit", resolve)),
    delay(3000).then(() => false)
  ]);

  if (stopped === false && workerProcess.exitCode === null) {
    workerProcess.kill("SIGKILL");
  }
}

async function main() {
  await applyMigrations();
  await verifyMigrationLedger();
  const worker = startWorker();

  try {
    await waitForWorker(worker);
    await runCommand(
      "run Worker v1 smoke",
      npmBin,
      ["run", "worker:smoke", "--", "--base-url", baseUrl],
      { cwd: repoRoot }
    );
    console.log(`\n[worker:smoke:local] passed: ${baseUrl}`);
  } finally {
    await stopWorker();
  }
}

process.on("SIGINT", () => {
  stopWorker().finally(() => process.exit(130));
});

main().catch((error) => {
  console.error(`\n[worker:smoke:local] failed: ${error instanceof Error ? error.message : String(error)}`);
  stopWorker().finally(() => process.exit(1));
});
