import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import { recordOperationalEvent } from "../db/operations";
import { getProviderPlace, upsertProviderPlaces } from "../db/places";
import { errorResponse } from "../http/errors";
import { rateLimit } from "../middleware/rate-limit";
import { geocodeAddress, reverseGeocodeCoordinate, searchPlaces } from "../providers";

export const placeRoutes = new Hono<AppBindings>();

placeRoutes.use("/search", rateLimit({
  keyPrefix: "places_search",
  limit: 60,
  windowSeconds: 60,
  methods: ["GET"]
}));
placeRoutes.use("/geocode", rateLimit({
  keyPrefix: "places_geocode",
  limit: 60,
  windowSeconds: 60,
  methods: ["GET"]
}));
placeRoutes.use("/reverse-geocode", rateLimit({
  keyPrefix: "places_reverse_geocode",
  limit: 60,
  windowSeconds: 60,
  methods: ["GET"]
}));

function numberParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

placeRoutes.get("/search", async (c) => {
  const startedAt = Date.now();
  const query = c.req.query("query")?.trim();
  if (!query) {
    return errorResponse(c, 400, "QUERY_REQUIRED", "검색어가 필요합니다.");
  }

  const category = c.req.query("category");
  const lat = numberParam(c.req.query("lat"));
  const lng = numberParam(c.req.query("lng"));
  const radius = numberParam(c.req.query("radius"));
  const result = await searchPlaces(c.env, {
    query,
    ...(category ? { category } : {}),
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    ...(radius !== undefined ? { radius } : {}),
    limit: numberParam(c.req.query("limit")) ?? 20
  });
  const savedPlaces = result.places.length
    ? await upsertProviderPlaces(c.env.DB, result.places)
    : [];
  await recordOperationalEvent(c.env.DB, {
    eventType: "provider_search",
    target: "places.search",
    status: result.warnings.length ? "warning" : "success",
    durationMs: Date.now() - startedAt,
    requestId: c.get("requestId"),
    metadata: {
      cacheStatus: result.cacheStatus,
      category: category ?? null,
      placeCount: result.places.length,
      warningCount: result.warnings.length
    }
  });

  return c.json({
    ok: true,
    places: savedPlaces.length ? savedPlaces : result.places,
    warnings: result.warnings,
    cacheStatus: result.cacheStatus,
    requestId: c.get("requestId")
  });
});

placeRoutes.get("/geocode", async (c) => {
  const address = c.req.query("address")?.trim();
  if (!address) {
    return errorResponse(c, 400, "ADDRESS_REQUIRED", "주소가 필요합니다.");
  }

  const result = await geocodeAddress(c.env, address);
  return c.json({
    ok: true,
    geocode: result.result,
    warnings: result.warnings,
    cacheStatus: result.cacheStatus,
    requestId: c.get("requestId")
  });
});

placeRoutes.get("/reverse-geocode", async (c) => {
  const lat = numberParam(c.req.query("lat"));
  const lng = numberParam(c.req.query("lng"));
  if (lat === undefined || lng === undefined) {
    return errorResponse(c, 400, "COORDINATES_REQUIRED", "위도와 경도가 필요합니다.");
  }

  const result = await reverseGeocodeCoordinate(c.env, { lat, lng });
  return c.json({
    ok: true,
    reverseGeocode: result.result,
    warnings: result.warnings,
    cacheStatus: result.cacheStatus,
    requestId: c.get("requestId")
  });
});

placeRoutes.get("/:placeId", async (c) => {
  const place = await getProviderPlace(c.env.DB, c.req.param("placeId"));
  if (!place) {
    return errorResponse(c, 404, "PLACE_NOT_FOUND", "장소 정보를 찾을 수 없습니다.");
  }

  return c.json({
    ok: true,
    place,
    requestId: c.get("requestId")
  });
});
