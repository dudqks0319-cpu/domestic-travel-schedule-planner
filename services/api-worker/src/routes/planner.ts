import { Hono } from "hono";
import { generateTripPlan, type TravelMode, type TravelStyleKey } from "@tripmate/planner";

import type { AppBindings } from "../bindings";
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

plannerRoutes.post("/generate", async (c) => {
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

plannerRoutes.post("/replan", (c) =>
  errorResponse(c, 501, "NOT_IMPLEMENTED", "일정 재생성 API는 trip persistence와 연결 후 구현됩니다.")
);
