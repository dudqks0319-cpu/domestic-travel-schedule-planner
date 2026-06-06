#!/usr/bin/env node

import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const workerRoot = path.join(repoRoot, "services", "api-worker");
const wranglerPath = path.join(workerRoot, "wrangler.toml");
const migrationsDir = path.join(workerRoot, "migrations");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const allowedTargets = new Set(["preview", "production"]);
const migrationLedgerTable = "schema_migrations";

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
  console.log(`TripMate remote D1 migration runner

Usage:
  npm run d1:migrate:preview
  npm run d1:migrate:production
  npm run d1:migrate:preview -- --plan
  npm run d1:migrate:production -- --plan
  node scripts/d1-migrate.mjs --target preview
  node scripts/d1-migrate.mjs --target production --confirm-production

Options:
  --target                preview or production.
  --plan                  Print applied and pending migrations without writing.
  --confirm-production    Required for production migrations.

This command records applied SQL files in schema_migrations and executes only
pending files from services/api-worker/migrations against the remote D1 database
configured for the target in services/api-worker/wrangler.toml.
Run it from a Cloudflare-authenticated shell after real D1 binding IDs are set.
`);
}

if (hasFlag("--help") || hasFlag("-h")) {
  printHelp();
  process.exit(0);
}

const target = readArg("--target", "");
const planOnly = hasFlag("--plan");

if (!allowedTargets.has(target)) {
  console.error("[d1:migrate] ERROR: --target must be preview or production.");
  process.exit(1);
}

if (target === "production" && !hasFlag("--confirm-production")) {
  console.error("[d1:migrate] ERROR: production migrations require --confirm-production.");
  process.exit(1);
}

function readTargetDatabaseName() {
  const wrangler = fs.readFileSync(wranglerPath, "utf8");
  const envMarker = `[env.${target}]`;
  const envIndex = wrangler.indexOf(envMarker);
  if (envIndex < 0) {
    throw new Error(`Missing ${envMarker} in services/api-worker/wrangler.toml`);
  }

  const nextEnvIndex = wrangler.indexOf("\n[env.", envIndex + envMarker.length);
  const targetBlock = nextEnvIndex < 0 ? wrangler.slice(envIndex) : wrangler.slice(envIndex, nextEnvIndex);
  const match = targetBlock.match(/database_name\s*=\s*"([^"]+)"/);
  if (!match?.[1]) {
    throw new Error(`Missing D1 database_name for env.${target}`);
  }

  return match[1];
}

function listMigrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();
}

function runWranglerD1(databaseName, args, options = {}) {
  if (options.label) {
    console.log(`\n[d1:migrate] ${options.label}`);
  }

  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(
      npmBin,
      [
        "exec",
        "--",
        "wrangler",
        "d1",
        "execute",
        databaseName,
        "--env",
        target,
        "--remote",
        ...args
      ],
      {
        cwd: workerRoot,
        env: process.env,
        stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
      }
    );

    if (options.capture) {
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
    }

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(output);
        return;
      }

      if (options.allowFailure) {
        resolve(output);
        return;
      }

      reject(new Error(`${options.label ?? "wrangler d1 execute"} failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}

async function ensureMigrationLedger(databaseName) {
  await runWranglerD1(
    databaseName,
    [
      `--command=CREATE TABLE IF NOT EXISTS ${migrationLedgerTable} (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));`
    ],
    { label: `${target}: ensure ${migrationLedgerTable}` }
  );
}

function parseAppliedMigrations(output) {
  const applied = new Set();
  if (/no such table:\s*schema_migrations/i.test(output)) {
    return applied;
  }

  const matches = output.matchAll(/"name"\s*:\s*"([^"]+)"/g);
  for (const match of matches) {
    applied.add(match[1]);
  }

  return applied;
}

async function listAppliedMigrations(databaseName) {
  const output = await runWranglerD1(
    databaseName,
    [`--command=SELECT name FROM ${migrationLedgerTable} ORDER BY name;`],
    { label: `${target}: read ${migrationLedgerTable}`, capture: true, allowFailure: planOnly }
  );

  return parseAppliedMigrations(output);
}

async function recordMigration(databaseName, migrationFile) {
  const escapedName = migrationFile.replaceAll("'", "''");
  await runWranglerD1(
    databaseName,
    [
      `--command=INSERT OR IGNORE INTO ${migrationLedgerTable} (name) VALUES ('${escapedName}');`
    ],
    { label: `${target}: record ${migrationFile}` }
  );
}

async function runMigration(databaseName, migrationFile) {
  await runWranglerD1(
    databaseName,
    [`--file=./migrations/${migrationFile}`],
    { label: `${target}: apply ${migrationFile} to ${databaseName}` }
  );
  await recordMigration(databaseName, migrationFile);
}

async function main() {
  const databaseName = readTargetDatabaseName();
  const migrations = listMigrationFiles();

  if (!migrations.length) {
    throw new Error("No D1 migration files found in services/api-worker/migrations.");
  }

  console.log(`[d1:migrate] target=${target} database=${databaseName} migrations=${migrations.length}`);
  if (!planOnly) {
    await ensureMigrationLedger(databaseName);
  }

  const appliedMigrations = await listAppliedMigrations(databaseName);
  const pendingMigrations = migrations.filter((migrationFile) => !appliedMigrations.has(migrationFile));

  if (planOnly) {
    console.log(`[d1:migrate] plan mode: no remote writes will be executed`);
    console.log(`[d1:migrate] applied=${appliedMigrations.size} pending=${pendingMigrations.length}`);
    for (const migrationFile of migrations) {
      const status = appliedMigrations.has(migrationFile) ? "applied" : "pending";
      console.log(`[d1:migrate] ${target}: ${status} ${migrationFile}`);
    }
    return;
  }

  for (const migrationFile of migrations) {
    if (appliedMigrations.has(migrationFile)) {
      console.log(`[d1:migrate] ${target}: skip already applied ${migrationFile}`);
      continue;
    }

    await runMigration(databaseName, migrationFile);
    appliedMigrations.add(migrationFile);
  }

  console.log(`\n[d1:migrate] completed: ${target} ${databaseName}`);
}

main().catch((error) => {
  console.error(`\n[d1:migrate] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
