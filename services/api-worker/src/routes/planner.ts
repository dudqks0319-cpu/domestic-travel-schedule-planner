import { Hono } from "hono";
import {
  generateTripPlan,
  type NormalizedPlace,
  type TravelMode,
  type TravelStyleKey
} from "@tripmate/planner";

import type { AppBindings } from "../bindings";
import { recordOperationalEvent } from "../db/operations";
import { errorResponse } from "../http/errors";
import { rateLimit } from "../middleware/rate-limit";
import { searchPlaces } from "../providers";

export const plannerRoutes = new Hono<AppBindings>();

plannerRoutes.use("/generate", rateLimit({
  keyPrefix: "planner_generate",
  limit: 20,
  windowSeconds: 60,
  methods: ["POST"]
}));

const STYLE_KEYS = new Set<TravelStyleKey>([
  "sea_cafe_food",
  "food_focused",
  "history_walk",
  "family_easy",
  "rainy_backup",
  "walker_transit",
  "drive_trip",
  "parents_comfort",
  "pet_friendly"
]);

function styleKey(value: unknown): TravelStyleKey {
  return typeof value === "string" && STYLE_KEYS.has(value as TravelStyleKey)
    ? (value as TravelStyleKey)
    : "sea_cafe_food";
}

function mode(value: unknown): TravelMode {
  if (value === "transit" || value === "walking" || value === "driving") return value;
  if (value === "walk") return "walking";
  if (value === "car") return "driving";
  return "driving";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const text = stringValue(item);
    return text ? [text] : [];
  });
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function booleanValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function providedPlaces(value: unknown): NormalizedPlace[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index): NormalizedPlace[] => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const name = stringValue(record.name);
    const category = stringValue(record.category);
    const lat = numberValue(record.lat);
    const lng = numberValue(record.lng);
    if (!name || !category || lat === null || lng === null) {
      return [];
    }

    const provider = record.provider === "naver" || record.provider === "kakao" || record.provider === "tour"
      ? record.provider
      : "manual";
    const id = stringValue(record.id) ?? `manual-replan-${index + 1}`;
    const providerPlaceId = stringValue(record.providerPlaceId);
    const address = stringValue(record.address);
    const roadAddress = stringValue(record.roadAddress);
    const phone = stringValue(record.phone);
    const imageUrl = stringValue(record.imageUrl);
    const sourceUrl = stringValue(record.sourceUrl);
    const description = stringValue(record.description);
    const sponsorLabel = stringValue(record.sponsorLabel);

    return [{
      id,
      provider,
      ...(providerPlaceId ? { providerPlaceId } : {}),
      name,
      category,
      ...(address ? { address } : {}),
      ...(roadAddress ? { roadAddress } : {}),
      lat,
      lng,
      ...(phone ? { phone } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(description ? { description } : {}),
      tags: stringArray(record.tags),
      score: numberValue(record.score) ?? 50,
      isSponsored: booleanValue(record.isSponsored),
      ...(sponsorLabel ? { sponsorLabel } : {})
    }];
  });
}

function tripField(raw: Record<string, unknown>, key: string): unknown {
  const trip = raw.trip && typeof raw.trip === "object" ? raw.trip as Record<string, unknown> : {};
  return raw[key] ?? trip[key];
}

plannerRoutes.post("/generate", async (c) => {
  const startedAt = Date.now();
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const destination = typeof raw.destination === "string" ? raw.destination.trim() : "";
  const startDate = typeof raw.startDate === "string" ? raw.startDate : "";
  const endDate = typeof raw.endDate === "string" ? raw.endDate : "";
  if (!destination || !startDate || !endDate) {
    return errorResponse(c, 400, "INVALID_PLANNER_INPUT", "지역과 날짜가 필요합니다.");
  }

  const query = typeof raw.keyword === "string" && raw.keyword.trim()
    ? raw.keyword.trim()
    : destination;
  const providerResult = await searchPlaces(c.env, {
    query,
    limit: 20
  });
  const selectedStyleKey = styleKey(raw.styleKey);
  const selectedMode = mode(raw.mode ?? raw.transport);
  const companions = typeof raw.companions === "string" ? raw.companions : undefined;
  const plan = generateTripPlan({
    destination,
    startDate,
    endDate,
    styleKey: selectedStyleKey,
    mode: selectedMode,
    ...(companions ? { companions } : {}),
    places: providerResult.places
  });
  const warningCount = plan.providerWarnings.length + providerResult.warnings.length;
  await recordOperationalEvent(c.env.DB, {
    eventType: "planner_generate",
    target: "planner.generate",
    status: warningCount ? "warning" : "success",
    durationMs: Date.now() - startedAt,
    requestId: c.get("requestId"),
    metadata: {
      cacheStatus: providerResult.cacheStatus,
      mode: selectedMode,
      placeCount: providerResult.places.length,
      styleKey: selectedStyleKey,
      warningCount
    }
  });

  return c.json({
    ok: true,
    trip: plan.trip,
    days: plan.days,
    routeSummary: plan.routeSummary,
    providerWarnings: [
      ...plan.providerWarnings,
      ...providerResult.warnings.map((warning) => ({
        provider: "planner",
        code: "PROVIDER_WARNING",
        message: warning,
        recoverable: true
      }))
    ],
    regenerationHints: plan.regenerationHints,
    cacheStatus: providerResult.cacheStatus,
    requestId: c.get("requestId")
  });
});

plannerRoutes.post("/replan", async (c) => {
  const startedAt = Date.now();
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const destination = stringValue(tripField(raw, "destination"));
  const startDate = stringValue(tripField(raw, "startDate"));
  const endDate = stringValue(tripField(raw, "endDate"));
  if (!destination || !startDate || !endDate) {
    return errorResponse(c, 400, "INVALID_REPLAN_INPUT", "재생성할 지역과 날짜가 필요합니다.");
  }

  const selectedStyleKey = styleKey(tripField(raw, "styleKey"));
  const selectedMode = mode(tripField(raw, "mode") ?? tripField(raw, "transportMode"));
  const existingPlaces = providedPlaces(raw.places);
  const removedPlaceIds = new Set(stringArray(raw.removedPlaceIds));
  const lockedPlaceIds = new Set(stringArray(raw.lockedPlaceIds));
  const retainedPlaces = existingPlaces.filter((place) => !removedPlaceIds.has(place.id));
  const lockedPlaces = retainedPlaces.filter((place) => lockedPlaceIds.has(place.id));
  const query = stringValue(raw.keyword) ?? stringValue(raw.replacementQuery) ?? destination;
  const shouldSearch = retainedPlaces.length < 6 || Boolean(raw.replacementQuery);
  const providerResult = shouldSearch
    ? await searchPlaces(c.env, { query, limit: 20 })
    : { places: [], warnings: [], cacheStatus: "skipped" as const };
  const places = [
    ...lockedPlaces,
    ...retainedPlaces.filter((place) => !lockedPlaceIds.has(place.id)),
    ...providerResult.places.filter((place) => !removedPlaceIds.has(place.id))
  ];
  const companions = stringValue(raw.companions);
  const plan = generateTripPlan({
    destination,
    startDate,
    endDate,
    styleKey: selectedStyleKey,
    mode: selectedMode,
    ...(companions ? { companions } : {}),
    places
  });
  const warningCount = plan.providerWarnings.length + providerResult.warnings.length;
  await recordOperationalEvent(c.env.DB, {
    eventType: "planner_replan",
    target: "planner.replan",
    status: warningCount ? "warning" : "success",
    durationMs: Date.now() - startedAt,
    requestId: c.get("requestId"),
    metadata: {
      cacheStatus: providerResult.cacheStatus,
      mode: selectedMode,
      placeCount: places.length,
      styleKey: selectedStyleKey,
      warningCount
    }
  });

  return c.json({
    ok: true,
    trip: plan.trip,
    days: plan.days,
    routeSummary: plan.routeSummary,
    providerWarnings: [
      ...plan.providerWarnings,
      ...providerResult.warnings.map((warning) => ({
        provider: "planner" as const,
        code: "PROVIDER_WARNING",
        message: warning,
        recoverable: true
      }))
    ],
    regenerationHints: [
      ...plan.regenerationHints,
      {
        code: "REPLAN_APPLIED",
        message: "기존 장소와 재검색 결과를 반영해 일정을 다시 정리했습니다.",
        severity: "info" as const
      }
    ],
    replan: {
      retainedPlaceCount: retainedPlaces.length,
      lockedPlaceCount: lockedPlaces.length,
      removedPlaceCount: removedPlaceIds.size,
      searchedProvider: shouldSearch,
      cacheStatus: providerResult.cacheStatus
    },
    requestId: c.get("requestId")
  });
});
