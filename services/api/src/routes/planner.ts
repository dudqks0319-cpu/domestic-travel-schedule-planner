import { Router } from "express";

import { prisma } from "../config/database";
import { optimizeRouteHandler } from "../controllers/route-controller";
import { authMiddleware } from "../middleware/auth";
import { optimizeRouteRateLimit } from "../middleware/route-rate-limit";
import { searchRestaurants, type NaverLocalItem } from "../services/restaurant.service";
import {
  AREA_CODES,
  searchAttractions,
  searchByKeyword,
  type TourItem
} from "../services/tourism.service";
import { sanitizePublicText } from "../utils/response-safety";

const plannerRouter = Router();
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const plannerTripInclude = {
  days: {
    orderBy: { dayNumber: "asc" as const },
    include: {
      places: {
        orderBy: { orderIndex: "asc" as const }
      }
    }
  }
};

interface PlannerPlaceCreateData {
  orderIndex: number;
  name: string;
  category: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  phone?: string | null;
  memo?: string | null;
}

interface PlannerCandidates {
  attractions: TourItem[];
  restaurants: NaverLocalItem[];
}

interface PlannerCandidateInput {
  destination: string;
  keyword?: string;
  area?: string;
  limit?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getQueryString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseRequiredString(value: unknown, field: string, errors: string[]): string | null {
  if (typeof value !== "string") {
    errors.push(`${field} is required and must be a string`);
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`${field} is required and must not be empty`);
    return null;
  }

  return trimmed;
}

function parseOptionalString(value: unknown, field: string, errors: string[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    errors.push(`${field} must be a string`);
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`${field} must not be empty`);
    return undefined;
  }

  return trimmed;
}

function parseOptionalNullableString(
  value: unknown,
  field: string,
  errors: string[]
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    errors.push(`${field} must be a string or null`);
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`${field} must not be empty`);
    return undefined;
  }

  return trimmed;
}

function parseRequiredDate(value: unknown, field: string, errors: string[]): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${field} is required and must be a valid date string`);
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${field} must be a valid date string`);
    return null;
  }

  return parsed;
}

function parseOptionalPositiveInteger(
  value: unknown,
  field: string,
  errors: string[]
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1) {
    errors.push(`${field} must be a positive integer`);
    return undefined;
  }

  return parsed;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseLatitude(value: unknown): number | undefined {
  const parsed = parseNumber(value);
  if (parsed === undefined || parsed < -90 || parsed > 90) {
    return undefined;
  }

  return parsed;
}

function parseLongitude(value: unknown): number | undefined {
  const parsed = parseNumber(value);
  if (parsed === undefined || parsed < -180 || parsed > 180) {
    return undefined;
  }

  return parsed;
}

function normalizeDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildTripDates(startDate: Date, endDate: Date): Date[] {
  const normalizedStart = normalizeDateOnly(startDate);
  const normalizedEnd = normalizeDateOnly(endDate);

  const dates: Date[] = [];
  for (
    let current = normalizedStart.getTime();
    current <= normalizedEnd.getTime();
    current += DAY_IN_MS
  ) {
    dates.push(new Date(current));
  }

  return dates;
}

function toAttractionPlace(item: TourItem, orderIndex: number): PlannerPlaceCreateData {
  const lat = parseLatitude(item.mapy);
  const lng = parseLongitude(item.mapx);
  const address = [item.addr1, item.addr2].filter(Boolean).join(" ").trim();

  return {
    orderIndex,
    name: item.title.trim(),
    category: "attraction",
    ...(address ? { address } : {}),
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    ...(item.firstimage || item.firstimage2 ? { imageUrl: item.firstimage || item.firstimage2 } : {}),
    ...(item.tel ? { phone: item.tel } : {})
  };
}

function toRestaurantPlace(item: NaverLocalItem, orderIndex: number): PlannerPlaceCreateData {
  const lat = parseLatitude(item.mapy);
  const lng = parseLongitude(item.mapx);
  const address = (item.roadAddress || item.address || "").trim();
  const category = item.category.trim() || "restaurant";

  return {
    orderIndex,
    name: item.title.trim(),
    category,
    ...(address ? { address } : {}),
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    ...(item.telephone ? { phone: item.telephone } : {})
  };
}

function buildDayPlaces(
  dayIndex: number,
  destination: string,
  attractions: TourItem[],
  restaurants: NaverLocalItem[]
): PlannerPlaceCreateData[] {
  const places: PlannerPlaceCreateData[] = [];
  const attractionCount = attractions.length >= 2 ? 2 : attractions.length;

  for (let i = 0; i < attractionCount; i += 1) {
    const attraction = attractions[(dayIndex * 2 + i) % attractions.length];
    places.push(toAttractionPlace(attraction, places.length));
  }

  if (restaurants.length > 0) {
    const restaurant = restaurants[dayIndex % restaurants.length];
    places.push(toRestaurantPlace(restaurant, places.length));
  }

  if (places.length === 0) {
    places.push({
      orderIndex: 0,
      name: `${destination} 자유 일정`,
      category: "free",
      memo: "추천 데이터를 찾지 못해 자유 일정으로 생성되었습니다."
    });
  }

  return places;
}

function normalizeLimit(value: unknown, defaultValue = 5, max = 20): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number.parseInt(value, 10)
        : defaultValue;

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

function pickAreaCode(destination: string, area?: string): string {
  const byArea = area ? AREA_CODES[area] : undefined;
  if (byArea) {
    return byArea;
  }

  const byDestination = AREA_CODES[destination];
  return byDestination ?? "1";
}

function logInternalError(scope: string, error: unknown) {
  const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
  console.error(`[planner] ${scope} failed: ${message || "unknown"}`);
}

async function fetchPlannerCandidates(input: PlannerCandidateInput): Promise<PlannerCandidates> {
  const limit = input.limit ?? 10;
  const restaurantQuery = input.keyword ?? `${input.destination} 맛집`;
  const areaCode = pickAreaCode(input.destination, input.area);

  const attractionsPromise = input.keyword
    ? searchByKeyword(input.keyword, 1)
    : searchAttractions({
        areaCode,
        pageNo: 1,
        numOfRows: Math.max(limit, 10)
      });

  const [attractionsResult, restaurantsResult] = await Promise.allSettled([
    attractionsPromise,
    searchRestaurants({
      query: restaurantQuery,
      display: limit,
      start: 1,
      sort: "comment"
    })
  ]);

  const attractions =
    attractionsResult.status === "fulfilled" ? attractionsResult.value : [];
  const restaurants =
    restaurantsResult.status === "fulfilled" ? restaurantsResult.value : [];

  if (attractionsResult.status === "rejected") {
    logInternalError("tourism recommendation lookup", attractionsResult.reason);
  }

  if (restaurantsResult.status === "rejected") {
    logInternalError("restaurant recommendation lookup", restaurantsResult.reason);
  }

  return { attractions, restaurants };
}

plannerRouter.post("/route/optimize", optimizeRouteRateLimit, optimizeRouteHandler);

plannerRouter.use(authMiddleware);

plannerRouter.post("/generate", async (req, res) => {
  try {
    const body = req.body as unknown;
    if (!isRecord(body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const errors: string[] = [];
    const destination = parseRequiredString(body.destination, "destination", errors);
    const startDate = parseRequiredDate(body.startDate, "startDate", errors);
    const endDate = parseRequiredDate(body.endDate, "endDate", errors);
    const title = parseOptionalString(body.title, "title", errors);
    const transport = parseOptionalNullableString(body.transport, "transport", errors);
    const companions = parseOptionalNullableString(body.companions, "companions", errors);
    const area = parseOptionalString(body.area, "area", errors);
    const keyword = parseOptionalString(body.keyword, "keyword", errors);

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      errors.push("startDate must be before or equal to endDate");
    }

    if (errors.length > 0 || !destination || !startDate || !endDate) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const dayDates = buildTripDates(startDate, endDate);
    const candidates = await fetchPlannerCandidates({
      destination,
      keyword,
      area,
      limit: 8
    });

    const trip = await prisma.trip.create({
      data: {
        title: title ?? `${destination} 여행`,
        destination,
        startDate,
        endDate,
        status: "draft",
        userId: req.user!.userId,
        ...(transport !== undefined ? { transport } : {}),
        ...(companions !== undefined ? { companions } : {}),
        days: {
          create: dayDates.map((date, dayIndex) => ({
            dayNumber: dayIndex + 1,
            date,
            places: {
              create: buildDayPlaces(
                dayIndex,
                destination,
                candidates.attractions,
                candidates.restaurants
              )
            }
          }))
        }
      },
      include: plannerTripInclude
    });

    return res.status(201).json({
      trip,
      recommendations: {
        attractions: candidates.attractions.length,
        restaurants: candidates.restaurants.length
      }
    });
  } catch (error) {
    logInternalError("generate itinerary", error);
    return res.status(500).json({ message: "여행 일정 생성 중 오류가 발생했습니다" });
  }
});

plannerRouter.post("/trips/:tripId/replan", async (req, res) => {
  try {
    const tripId = getQueryString(req.params.tripId);
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    const body = req.body as unknown;
    if (body !== undefined && !isRecord(body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }
    const payload = isRecord(body) ? body : {};

    const errors: string[] = [];
    const dayNumber = parseOptionalPositiveInteger(payload.dayNumber, "dayNumber", errors);
    const keyword = parseOptionalString(payload.keyword, "keyword", errors);
    const area = parseOptionalString(payload.area, "area", errors);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: req.user!.userId
      },
      include: plannerTripInclude
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const targetDays =
      dayNumber === undefined
        ? trip.days
        : trip.days.filter((tripDay) => tripDay.dayNumber === dayNumber);

    if (targetDays.length === 0) {
      return res.status(404).json({ message: "Target day not found in trip" });
    }

    const candidates = await fetchPlannerCandidates({
      destination: trip.destination,
      keyword,
      area,
      limit: 8
    });

    await prisma.$transaction(
      targetDays.map((tripDay) =>
        prisma.tripDay.update({
          where: { id: tripDay.id },
          data: {
            places: {
              deleteMany: {},
              create: buildDayPlaces(
                Math.max(0, tripDay.dayNumber - 1),
                trip.destination,
                candidates.attractions,
                candidates.restaurants
              )
            }
          }
        })
      )
    );

    const updatedTrip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: req.user!.userId
      },
      include: plannerTripInclude
    });

    return res.json({
      trip: updatedTrip,
      replannedDays: targetDays.length,
      recommendations: {
        attractions: candidates.attractions.length,
        restaurants: candidates.restaurants.length
      }
    });
  } catch (error) {
    logInternalError("replan trip", error);
    return res.status(500).json({ message: "여행 일정 재생성 중 오류가 발생했습니다" });
  }
});

plannerRouter.get("/trips/:tripId/summary", async (req, res) => {
  try {
    const tripId = getQueryString(req.params.tripId);
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: req.user!.userId
      },
      include: plannerTripInclude
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const totalPlaces = trip.days.reduce((sum, day) => sum + day.places.length, 0);
    const plannedDays = trip.days.filter((day) => day.places.length > 0).length;
    const placesByCategory = trip.days.reduce<Record<string, number>>((acc, day) => {
      for (const place of day.places) {
        const key = place.category.trim() || "uncategorized";
        acc[key] = (acc[key] ?? 0) + 1;
      }
      return acc;
    }, {});

    return res.json({
      summary: {
        tripId: trip.id,
        title: trip.title,
        destination: trip.destination,
        status: trip.status,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        totalDays: trip.days.length,
        plannedDays,
        totalPlaces,
        placesByCategory
      }
    });
  } catch (error) {
    logInternalError("trip summary lookup", error);
    return res.status(500).json({ message: "여행 요약 조회 중 오류가 발생했습니다" });
  }
});

plannerRouter.get("/suggestions/destinations", async (req, res) => {
  try {
    const keyword = getQueryString(req.query.keyword);
    const area = getQueryString(req.query.area);
    const limit = normalizeLimit(req.query.limit, 5, 20);
    const destination = area ?? keyword ?? "서울";

    const candidates = await fetchPlannerCandidates({
      destination,
      keyword,
      area,
      limit
    });

    const destinations = candidates.attractions.slice(0, limit).map((item) => {
      const lat = parseLatitude(item.mapy);
      const lng = parseLongitude(item.mapx);
      const address = [item.addr1, item.addr2].filter(Boolean).join(" ").trim();

      return {
        id: item.contentid,
        title: item.title,
        address,
        imageUrl: item.firstimage || item.firstimage2 || null,
        ...(lat !== undefined ? { lat } : {}),
        ...(lng !== undefined ? { lng } : {})
      };
    });

    const restaurants = candidates.restaurants.slice(0, limit).map((item) => {
      const lat = parseLatitude(item.mapy);
      const lng = parseLongitude(item.mapx);

      return {
        title: item.title,
        category: item.category,
        address: item.roadAddress || item.address || "",
        phone: item.telephone || null,
        ...(lat !== undefined ? { lat } : {}),
        ...(lng !== undefined ? { lng } : {})
      };
    });

    return res.json({
      destinations,
      restaurants
    });
  } catch (error) {
    logInternalError("destination suggestions lookup", error);
    return res.status(500).json({ message: "추천 여행지 조회 중 오류가 발생했습니다" });
  }
});

export { plannerRouter };
