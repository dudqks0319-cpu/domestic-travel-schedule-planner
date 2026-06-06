import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import { getProviderPlace, upsertProviderPlaces } from "../db/places";
import { errorResponse } from "../http/errors";
import { searchPlaces } from "../providers";

export const placeRoutes = new Hono<AppBindings>();

function numberParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

placeRoutes.get("/search", async (c) => {
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

  return c.json({
    ok: true,
    places: savedPlaces.length ? savedPlaces : result.places,
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
