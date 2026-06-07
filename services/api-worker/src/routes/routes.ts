import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import { recordOperationalEvent } from "../db/operations";
import { createRouteCacheKey, getCachedRoute, upsertRouteCache } from "../db/route-cache";
import { errorResponse } from "../http/errors";
import { rateLimit } from "../middleware/rate-limit";
import { getProviderDirections } from "../providers";
import { hasNaverMapsCredentials } from "../providers/naver";
import type { NormalizedRoute, RouteProviderKind, TravelMode } from "../providers/types";

export const routeRoutes = new Hono<AppBindings>();

const MAX_ROUTE_OPTIMIZE_POINTS = 7;
const MAX_ROUTE_POINT_LABEL_LENGTH = 120;

routeRoutes.use("/optimize", rateLimit({
  keyPrefix: "routes_optimize",
  limit: 30,
  windowSeconds: 60,
  methods: ["POST"]
}));

interface RoutePointInput {
  id?: string;
  name?: string;
  lat: number;
  lng: number;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKm(from: RoutePointInput, to: RoutePointInput): number {
  const radiusKm = 6371;
  const latDiff = toRad(to.lat - from.lat);
  const lngDiff = toRad(to.lng - from.lng);
  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(lngDiff / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mode(value: unknown): TravelMode {
  if (value === "transit" || value === "walking" || value === "driving") return value;
  return "driving";
}

function speed(modeValue: TravelMode): number {
  if (modeValue === "walking") return 4.5;
  if (modeValue === "transit") return 24;
  return 38;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function pointLabel(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const label = value.trim();
  return label ? label.slice(0, MAX_ROUTE_POINT_LABEL_LENGTH) : undefined;
}

function parsePoints(value: unknown): RoutePointInput[] | null {
  if (!Array.isArray(value)) return [];
  const points: RoutePointInput[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const lat = typeof record.lat === "number" ? record.lat : null;
    const lng = typeof record.lng === "number" ? record.lng : null;
    if (lat === null || lng === null || !isValidCoordinate(lat, lng)) {
      return null;
    }

    const id = pointLabel(record.id);
    const name = pointLabel(record.name);
    points.push({
      ...(id ? { id } : {}),
      ...(name ? { name } : {}),
      lat,
      lng
    });
  }

  return points;
}

function providerCacheScopes(env: AppBindings["Bindings"], selectedMode: TravelMode): RouteProviderKind[] {
  if (selectedMode !== "driving") {
    return [];
  }

  const scopes: RouteProviderKind[] = [];
  if (hasNaverMapsCredentials(env)) {
    scopes.push("naver");
  }
  if (env.KAKAO_REST_API_KEY) {
    scopes.push("kakao");
  }
  return scopes;
}

async function getFirstCachedProviderRoute(
  db: D1Database,
  selectedMode: TravelMode,
  points: RoutePointInput[],
  providerScopes: RouteProviderKind[]
): Promise<{ route: NormalizedRoute; providerScope: RouteProviderKind } | null> {
  for (const providerScope of providerScopes) {
    const cacheKey = await createRouteCacheKey(selectedMode, points, providerScope);
    const route = await getCachedRoute(db, cacheKey);
    if (route) {
      return { route, providerScope };
    }
  }
  return null;
}

function buildFallbackRoute(
  points: RoutePointInput[],
  selectedMode: TravelMode,
  warnings: string[] = []
): NormalizedRoute {
  const segments = points.slice(0, -1).map((from, index) => {
    const to = points[index + 1] as RoutePointInput;
    const segmentDistanceKm = Math.round(distanceKm(from, to) * 1.2 * 10) / 10;
    return {
      from: from.id ?? from.name ?? `point-${index + 1}`,
      to: to.id ?? to.name ?? `point-${index + 2}`,
      distanceKm: segmentDistanceKm,
      durationMin: Math.max(1, Math.round((segmentDistanceKm / speed(selectedMode)) * 60)),
      provider: "fallback" as const
    };
  });

  return {
    provider: "fallback",
    mode: selectedMode,
    orderedPoints: points,
    segments,
    totalDistanceKm: Math.round(segments.reduce((sum, segment) => sum + segment.distanceKm, 0) * 10) / 10,
    totalDurationMin: segments.reduce((sum, segment) => sum + segment.durationMin, 0),
    warnings: [
      ...warnings,
      "실제 길찾기 provider를 사용할 수 없어 직선 거리 기반 예상 이동시간을 반환합니다."
    ]
  };
}

routeRoutes.post("/optimize", async (c) => {
  const startedAt = Date.now();
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  if (Array.isArray(raw.points) && raw.points.length > MAX_ROUTE_OPTIMIZE_POINTS) {
    return errorResponse(c, 400, "ROUTE_POINT_LIMIT_EXCEEDED", "한 번에 계산할 수 있는 장소 수를 초과했습니다.");
  }

  const points = parsePoints(raw.points);
  if (points === null) {
    return errorResponse(c, 400, "INVALID_ROUTE_POINTS", "경로 좌표를 확인해주세요.");
  }
  if (points.length < 2) {
    return errorResponse(c, 400, "ROUTE_POINTS_REQUIRED", "경로 계산에는 2개 이상의 장소가 필요합니다.");
  }

  const selectedMode = mode(raw.mode);
  const providerScopes = providerCacheScopes(c.env, selectedMode);
  const cachedProviderRoute = await getFirstCachedProviderRoute(c.env.DB, selectedMode, points, providerScopes);
  if (cachedProviderRoute) {
    await recordOperationalEvent(c.env.DB, {
      eventType: "route_optimize",
      target: "routes.optimize",
      status: cachedProviderRoute.route.warnings.length ? "warning" : "success",
      durationMs: Date.now() - startedAt,
      requestId: c.get("requestId"),
      metadata: {
        cacheStatus: "hit",
        provider: cachedProviderRoute.providerScope,
        mode: selectedMode,
        pointCount: points.length,
        segmentCount: cachedProviderRoute.route.segments.length,
        warningCount: cachedProviderRoute.route.warnings.length
      }
    });

    return c.json({
      ok: true,
      route: cachedProviderRoute.route,
      cacheStatus: "hit",
      requestId: c.get("requestId")
    });
  }

  const providerResult = providerScopes.length
    ? await getProviderDirections(c.env, { points, mode: selectedMode })
    : { route: null, warnings: [] };
  const fallbackCacheKey = await createRouteCacheKey(selectedMode, points, "fallback");
  const cachedFallbackRoute = providerResult.route ? null : await getCachedRoute(c.env.DB, fallbackCacheKey);
  const route = providerResult.route ?? cachedFallbackRoute ?? buildFallbackRoute(points, selectedMode, providerResult.warnings);

  if (providerResult.route) {
    const routeCacheKey = await createRouteCacheKey(selectedMode, points, providerResult.route.provider);
    await upsertRouteCache(c.env.DB, {
      cacheKey: routeCacheKey,
      route
    });
  } else if (!cachedFallbackRoute) {
    await upsertRouteCache(c.env.DB, {
      cacheKey: fallbackCacheKey,
      route
    });
  }

  await recordOperationalEvent(c.env.DB, {
    eventType: "route_optimize",
    target: "routes.optimize",
    status: route.warnings.length ? "warning" : "success",
    durationMs: Date.now() - startedAt,
    requestId: c.get("requestId"),
    metadata: {
      cacheStatus: cachedFallbackRoute ? "hit" : "miss",
      provider: route.provider,
      mode: selectedMode,
      pointCount: points.length,
      segmentCount: route.segments.length,
      warningCount: route.warnings.length
    }
  });

  return c.json({
    ok: true,
    route,
    cacheStatus: cachedFallbackRoute ? "hit" : "miss",
    requestId: c.get("requestId")
  });
});
