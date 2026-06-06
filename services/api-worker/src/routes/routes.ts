import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import { recordOperationalEvent } from "../db/operations";
import { createRouteCacheKey, getCachedRoute, upsertRouteCache } from "../db/route-cache";
import { errorResponse } from "../http/errors";
import { rateLimit } from "../middleware/rate-limit";
import type { NormalizedRoute, TravelMode } from "../providers/types";

export const routeRoutes = new Hono<AppBindings>();

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

function parsePoints(value: unknown): RoutePointInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const lat = typeof record.lat === "number" ? record.lat : null;
    const lng = typeof record.lng === "number" ? record.lng : null;
    if (lat === null || lng === null) return [];
    return [{
      ...(typeof record.id === "string" ? { id: record.id } : {}),
      ...(typeof record.name === "string" ? { name: record.name } : {}),
      lat,
      lng
    }];
  });
}

routeRoutes.post("/optimize", async (c) => {
  const startedAt = Date.now();
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const points = parsePoints(raw.points);
  if (points.length < 2) {
    return errorResponse(c, 400, "ROUTE_POINTS_REQUIRED", "경로 계산에는 2개 이상의 장소가 필요합니다.");
  }

  const selectedMode = mode(raw.mode);
  const routeCacheKey = await createRouteCacheKey(selectedMode, points);
  const cachedRoute = await getCachedRoute(c.env.DB, routeCacheKey);
  if (cachedRoute) {
    await recordOperationalEvent(c.env.DB, {
      eventType: "route_optimize",
      target: "routes.optimize",
      status: cachedRoute.warnings.length ? "warning" : "success",
      durationMs: Date.now() - startedAt,
      requestId: c.get("requestId"),
      metadata: {
        cacheStatus: "hit",
        mode: selectedMode,
        pointCount: points.length,
        segmentCount: cachedRoute.segments.length,
        warningCount: cachedRoute.warnings.length
      }
    });

    return c.json({
      ok: true,
      route: cachedRoute,
      cacheStatus: "hit",
      requestId: c.get("requestId")
    });
  }

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
  const route: NormalizedRoute = {
    provider: "fallback",
    mode: selectedMode,
    orderedPoints: points,
    segments,
    totalDistanceKm: Math.round(segments.reduce((sum, segment) => sum + segment.distanceKm, 0) * 10) / 10,
    totalDurationMin: segments.reduce((sum, segment) => sum + segment.durationMin, 0),
    warnings: ["실제 길찾기 provider 연결 전까지 직선 거리 기반 예상 이동시간을 반환합니다."]
  };
  await upsertRouteCache(c.env.DB, {
    cacheKey: routeCacheKey,
    route
  });
  await recordOperationalEvent(c.env.DB, {
    eventType: "route_optimize",
    target: "routes.optimize",
    status: "warning",
    durationMs: Date.now() - startedAt,
    requestId: c.get("requestId"),
    metadata: {
      cacheStatus: "miss",
      mode: selectedMode,
      pointCount: points.length,
      segmentCount: segments.length,
      warningCount: 1
    }
  });

  return c.json({
    ok: true,
    route,
    cacheStatus: "miss",
    requestId: c.get("requestId")
  });
});
