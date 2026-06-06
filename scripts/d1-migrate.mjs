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
  node scripts/d1-migrate.mjs --target preview
  node scripts/d1-migrate.mjs --target production --confirm-production

Options:
  --target                preview or production.
  --confirm-production    Required for production migrations.

This command executes every SQL file in services/api-worker/migrations against
the remote D1 database configured for the target in services/api-worker/wrangler.toml.
Run it from a Cloudflare-authenticated shell after real D1 binding IDs are set.
`);
}

if (hasFlag("--help") || hasFlag("-h")) {
  printHelp();
  process.exit(0);
}

const target = readArg("--target", "");

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

function runMigration(databaseName, migrationFile) {
  console.log(`\n[d1:migrate] ${target}: apply ${migrationFile} to ${databaseName}`);

  return new Promise((resolve, reject) => {
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
        `--file=./migrations/${migrationFile}`
      ],
      {
        cwd: workerRoot,
        env: process.env,
        stdio: "inherit"
      }
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${migrationFile} failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}

async function main() {
  const databaseName = readTargetDatabaseName();
  const migrations = listMigrationFiles();

  if (!migrations.length) {
    throw new Error("No D1 migration files found in services/api-worker/migrations.");
  }

  console.log(`[d1:migrate] target=${target} database=${databaseName} migrations=${migrations.length}`);
  for (const migrationFile of migrations) {
    await runMigration(databaseName, migrationFile);
  }

  console.log(`\n[d1:migrate] completed: ${target} ${databaseName}`);
}

main().catch((error) => {
  console.error(`\n[d1:migrate] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
