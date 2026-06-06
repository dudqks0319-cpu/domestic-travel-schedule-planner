import { spawnSync } from "node:child_process";
import process from "node:process";

const allowedTargets = new Set(["preview", "production"]);
const requiredSecrets = [
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

function readArg(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv.includes("--print-required")) {
  console.log(requiredSecrets.join("\n"));
  process.exit(0);
}

const target = readArg("--target") ?? "preview";
if (!allowedTargets.has(target)) {
  console.error("[check:secrets] ERROR: Use --target preview or --target production.");
  process.exit(1);
}

const result = spawnSync(
  "npm",
  ["--prefix", "services/api-worker", "exec", "wrangler", "secret", "list", "--env", target, "--json"],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }
);

if (result.error) {
  console.error(`[check:secrets] ERROR: Failed to run wrangler: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  const detail = result.stderr.trim() || result.stdout.trim() || `exit status ${result.status}`;
  console.error(`[check:secrets] ERROR: wrangler secret list failed for ${target}: ${detail}`);
  process.exit(result.status ?? 1);
}

let parsed;
try {
  parsed = JSON.parse(result.stdout);
} catch (error) {
  console.error(
    `[check:secrets] ERROR: Could not parse wrangler secret list JSON: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exit(1);
}

const configuredNames = new Set(
  Array.isArray(parsed)
    ? parsed
      .map((entry) => typeof entry === "string" ? entry : entry?.name)
      .filter((name) => typeof name === "string" && name.length > 0)
    : []
);
const missing = requiredSecrets.filter((secretName) => !configuredNames.has(secretName));

if (missing.length > 0) {
  for (const secretName of missing) {
    console.error(`[check:secrets] ERROR: Missing Cloudflare ${target} secret: ${secretName}`);
  }
  process.exit(1);
}

console.log(`[check:secrets] Cloudflare ${target} required secrets are configured.`);
