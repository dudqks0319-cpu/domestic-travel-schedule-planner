import type { NormalizedRoute, TravelMode } from "../providers/types";

interface RouteCacheRecord {
  provider: string;
  mode: TravelMode;
  route_json: string;
  expires_at: string;
}

const ROUTE_CACHE_TTL_HOURS = 6;

function sqlTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function routeExpiresAt(): string {
  return sqlTimestamp(new Date(Date.now() + ROUTE_CACHE_TTL_HOURS * 60 * 60 * 1000));
}

function normalizePoint(point: { lat: number; lng: number }) {
  return {
    lat: Number(point.lat.toFixed(5)),
    lng: Number(point.lng.toFixed(5))
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createRouteCacheKey(
  mode: TravelMode,
  points: Array<{ lat: number; lng: number }>
): Promise<string> {
  return `route:v1:${await sha256Hex(JSON.stringify({
    mode,
    points: points.map(normalizePoint)
  }))}`;
}

export async function getCachedRoute(
  db: D1Database,
  cacheKey: string
): Promise<NormalizedRoute | null> {
  const record = await db
    .prepare(
      `SELECT provider, mode, route_json, expires_at
       FROM route_cache
       WHERE cache_key = ?
         AND deleted_at IS NULL
         AND expires_at > datetime('now')
       LIMIT 1`
    )
    .bind(cacheKey)
    .first<RouteCacheRecord>();

  if (!record) {
    return null;
  }

  try {
    return JSON.parse(record.route_json) as NormalizedRoute;
  } catch {
    return null;
  }
}

export async function upsertRouteCache(
  db: D1Database,
  input: {
    cacheKey: string;
    route: NormalizedRoute;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO route_cache (id, cache_key, provider, mode, route_json, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
        provider = excluded.provider,
        mode = excluded.mode,
        route_json = excluded.route_json,
        expires_at = excluded.expires_at,
        updated_at = datetime('now'),
        deleted_at = NULL`
    )
    .bind(
      crypto.randomUUID(),
      input.cacheKey,
      input.route.provider,
      input.route.mode,
      JSON.stringify(input.route),
      routeExpiresAt()
    )
    .run();
}
