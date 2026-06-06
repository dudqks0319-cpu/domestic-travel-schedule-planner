import { Hono } from "hono";
import {
  generateTripPlan,
  type NormalizedPlace,
  type NormalizedRouteSegment,
  type ProviderWarning,
  type RouteProviderKind,
  type RouteSummary,
  type TravelMode,
  type TravelStyleKey,
  type TripDayPlan,
  type TripPlanResult
} from "@tripmate/planner";

import type { AppBindings, Env } from "../bindings";
import { recordOperationalEvent } from "../db/operations";
import { errorResponse } from "../http/errors";
import { rateLimit } from "../middleware/rate-limit";
import { getProviderDirections, searchPlaces } from "../providers";

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

function parseClock(value: string | undefined): number {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return 9 * 60;
  }

  const [hourText, minuteText] = value.split(":");
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 9 * 60;
  }

  return hours * 60 + minutes;
}

function formatClock(totalMinutes: number): string {
  const normalized = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function searchWarnings(warnings: string[]): ProviderWarning[] {
  return warnings.map((warning) => ({
    provider: "planner" as const,
    code: "PROVIDER_WARNING",
    message: warning,
    recoverable: true
  }));
}

function routeWarning(message: string): ProviderWarning {
  return {
    provider: "kakao",
    code: "ROUTE_PROVIDER_WARNING",
    message,
    recoverable: true
  };
}

function placeLookup(places: NormalizedPlace[]): Map<string, NormalizedPlace> {
  const lookup = new Map<string, NormalizedPlace>();
  for (const place of places) {
    lookup.set(place.id, place);
    if (place.providerPlaceId) {
      lookup.set(place.providerPlaceId, place);
    }
  }

  return lookup;
}

function routeSummaryProvider(segments: NormalizedRouteSegment[]): RouteProviderKind {
  const providers = new Set(segments.map((segment) => segment.provider));
  if (providers.size === 1) {
    return segments[0]?.provider ?? "fallback";
  }
  return "mixed";
}

function rebuildRouteSummary(
  days: TripDayPlan[],
  mode: TravelMode,
  warnings: string[]
): RouteSummary {
  const segments = days.flatMap((day) =>
    day.places
      .map((place) => place.routeToNext)
      .filter((segment): segment is NormalizedRouteSegment => Boolean(segment))
  );

  return {
    provider: routeSummaryProvider(segments),
    mode,
    totalDistanceKm: Math.round(segments.reduce((sum, segment) => sum + segment.distanceKm, 0) * 10) / 10,
    totalDurationMin: segments.reduce((sum, segment) => sum + segment.durationMin, 0),
    warnings
  };
}

function rebuildDayPlacesWithSegments(
  day: TripDayPlan,
  segments: NormalizedRouteSegment[]
): TripDayPlan {
  let cursor = parseClock(day.places[0]?.startTime);

  return {
    ...day,
    places: day.places.map((place, index) => {
      const { routeToNext: _previousRouteToNext, ...rest } = place;
      const routeToNext = segments[index];
      const startTime = formatClock(cursor);
      const endTime = formatClock(cursor + place.stayDurationMin);
      cursor += place.stayDurationMin + (routeToNext?.durationMin ?? 0);

      return {
        ...rest,
        startTime,
        endTime,
        ...(routeToNext ? { routeToNext } : {})
      };
    })
  };
}

async function enrichPlanWithProviderRoutes(
  env: Env,
  plan: TripPlanResult,
  places: NormalizedPlace[],
  selectedMode: TravelMode
): Promise<TripPlanResult> {
  if (selectedMode !== "driving" || !env.KAKAO_REST_API_KEY) {
    return plan;
  }

  const placesById = placeLookup(places);
  const providerWarnings: ProviderWarning[] = [];
  const routeSummaryWarnings = [...plan.routeSummary.warnings];
  let usedProviderRoute = false;

  const days = await Promise.all(plan.days.map(async (day) => {
    const sourcePlaces = day.places.flatMap((place) => {
      const source = place.placeId ? placesById.get(place.placeId) : undefined;
      return source ? [source] : [];
    });

    if (sourcePlaces.length !== day.places.length || sourcePlaces.length < 2 || sourcePlaces.length > 7) {
      return day;
    }

    const result = await getProviderDirections(env, {
      mode: selectedMode,
      points: sourcePlaces.map((place) => ({
        id: place.id,
        name: place.name,
        lat: place.lat,
        lng: place.lng
      }))
    });

    if (!result.route) {
      if (result.warnings.length) {
        const message = "Kakao route provider could not enrich planner day routes; fallback movement times remain.";
        providerWarnings.push(routeWarning(message));
        routeSummaryWarnings.push(message);
      }
      return day;
    }

    usedProviderRoute = true;
    const segments = result.route.segments.map((segment, index): NormalizedRouteSegment => {
      const from = sourcePlaces[index] as NormalizedPlace;
      const to = sourcePlaces[index + 1] as NormalizedPlace;
      return {
        from: from.id,
        to: to.id,
        distanceKm: segment.distanceKm,
        durationMin: segment.durationMin,
        provider: segment.provider
      };
    });

    return rebuildDayPlacesWithSegments(day, segments);
  }));

  if (!usedProviderRoute && providerWarnings.length === 0) {
    return plan;
  }

  return {
    ...plan,
    days,
    routeSummary: rebuildRouteSummary(days, selectedMode, routeSummaryWarnings),
    providerWarnings: [
      ...plan.providerWarnings,
      ...providerWarnings
    ]
  };
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
  const basePlan = generateTripPlan({
    destination,
    startDate,
    endDate,
    styleKey: selectedStyleKey,
    mode: selectedMode,
    ...(companions ? { companions } : {}),
    places: providerResult.places
  });
  const plan = await enrichPlanWithProviderRoutes(c.env, basePlan, providerResult.places, selectedMode);
  const providerWarnings = [
    ...plan.providerWarnings,
    ...searchWarnings(providerResult.warnings)
  ];
  const warningCount = providerWarnings.length;
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
      provider: plan.routeSummary.provider,
      styleKey: selectedStyleKey,
      warningCount
    }
  });

  return c.json({
    ok: true,
    trip: plan.trip,
    days: plan.days,
    routeSummary: plan.routeSummary,
    providerWarnings,
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
  const basePlan = generateTripPlan({
    destination,
    startDate,
    endDate,
    styleKey: selectedStyleKey,
    mode: selectedMode,
    ...(companions ? { companions } : {}),
    places
  });
  const plan = await enrichPlanWithProviderRoutes(c.env, basePlan, places, selectedMode);
  const providerWarnings = [
    ...plan.providerWarnings,
    ...searchWarnings(providerResult.warnings)
  ];
  const warningCount = providerWarnings.length;
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
      provider: plan.routeSummary.provider,
      styleKey: selectedStyleKey,
      warningCount
    }
  });

  return c.json({
    ok: true,
    trip: plan.trip,
    days: plan.days,
    routeSummary: plan.routeSummary,
    providerWarnings,
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
    places,
    requestId: c.get("requestId")
  });
});
