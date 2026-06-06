import { haversineDistanceKm } from "./geo";
import type {
  NormalizedPlace,
  NormalizedRouteSegment,
  ProviderWarning,
  RouteSummary,
  TravelMode,
  TravelStyleKey,
  TripDayPlan,
  TripPlacePlan,
  TripPlanInput,
  TripPlanResult
} from "./domain";

interface StyleRule {
  maxPlacesPerDay: number;
  maxSameDayDistanceKm: number;
  categoryBoosts: Record<string, number>;
  dwellAdjustmentMin: number;
}

const STYLE_RULES: Record<TravelStyleKey, StyleRule> = {
  sea_cafe_food: {
    maxPlacesPerDay: 4,
    maxSameDayDistanceKm: 55,
    categoryBoosts: { attraction: 8, cafe: 10, restaurant: 9, nature: 8 },
    dwellAdjustmentMin: 0
  },
  food_focused: {
    maxPlacesPerDay: 5,
    maxSameDayDistanceKm: 40,
    categoryBoosts: { restaurant: 18, cafe: 12, market: 8 },
    dwellAdjustmentMin: 0
  },
  history_walk: {
    maxPlacesPerDay: 4,
    maxSameDayDistanceKm: 18,
    categoryBoosts: { attraction: 10, museum: 12, culture: 12, history: 16 },
    dwellAdjustmentMin: 10
  },
  family_easy: {
    maxPlacesPerDay: 3,
    maxSameDayDistanceKm: 28,
    categoryBoosts: { kids: 16, indoor: 10, attraction: 8, cafe: 6 },
    dwellAdjustmentMin: 15
  },
  rainy_backup: {
    maxPlacesPerDay: 4,
    maxSameDayDistanceKm: 25,
    categoryBoosts: { indoor: 18, museum: 14, cafe: 10, restaurant: 8 },
    dwellAdjustmentMin: 0
  },
  walker_transit: {
    maxPlacesPerDay: 4,
    maxSameDayDistanceKm: 12,
    categoryBoosts: { station: 8, walk: 10, cafe: 8, attraction: 7 },
    dwellAdjustmentMin: 0
  },
  drive_trip: {
    maxPlacesPerDay: 5,
    maxSameDayDistanceKm: 120,
    categoryBoosts: { nature: 12, viewpoint: 10, attraction: 8, restaurant: 6 },
    dwellAdjustmentMin: 0
  },
  parents_comfort: {
    maxPlacesPerDay: 3,
    maxSameDayDistanceKm: 35,
    categoryBoosts: { nature: 10, restaurant: 9, cafe: 8, indoor: 8 },
    dwellAdjustmentMin: 20
  },
  pet_friendly: {
    maxPlacesPerDay: 4,
    maxSameDayDistanceKm: 45,
    categoryBoosts: { pet: 18, outdoor: 12, cafe: 8, nature: 8 },
    dwellAdjustmentMin: 0
  }
};

const MODE_SPEED_KMH: Record<TravelMode, number> = {
  driving: 38,
  transit: 24,
  walking: 4.5
};

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTripDayCount(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) {
    return 1;
  }

  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.min(diffDays, 15));
}

function dateOffset(startDate: string, offsetDays: number): string {
  const start = parseDateOnly(startDate);
  if (!start) {
    return "";
  }

  const date = new Date(start);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function normalizedText(place: NormalizedPlace): string {
  return [place.category, place.name, place.description, ...place.tags]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

function categoryBucket(place: NormalizedPlace): string {
  const text = normalizedText(place);
  if (/카페|cafe|coffee|디저트|베이커리/.test(text)) return "cafe";
  if (/맛집|음식|식당|restaurant|해산물|고기|시장/.test(text)) return "restaurant";
  if (/숙소|호텔|리조트|hotel|stay/.test(text)) return "lodging";
  if (/박물관|전시|미술관|museum|실내/.test(text)) return "museum";
  if (/역사|문화|궁|한옥|culture|history/.test(text)) return "history";
  if (/아이|키즈|체험|kids/.test(text)) return "kids";
  if (/반려|pet|강아지/.test(text)) return "pet";
  if (/자연|바다|산|공원|해변|숲|nature|outdoor/.test(text)) return "nature";
  return "attraction";
}

function modeDistanceMultiplier(mode: TravelMode): number {
  if (mode === "walking") return 1.08;
  if (mode === "transit") return 1.3;
  return 1.2;
}

function estimateSegment(from: NormalizedPlace, to: NormalizedPlace, mode: TravelMode): NormalizedRouteSegment {
  const baseDistanceKm = haversineDistanceKm(
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng }
  );
  const distanceKm = Math.round(baseDistanceKm * modeDistanceMultiplier(mode) * 10) / 10;
  const durationMin = Math.max(1, Math.round((distanceKm / MODE_SPEED_KMH[mode]) * 60));

  return {
    from: from.id,
    to: to.id,
    distanceKm,
    durationMin,
    provider: "fallback"
  };
}

function placeScore(place: NormalizedPlace, rule: StyleRule): number {
  const bucket = categoryBucket(place);
  const tagBoost = place.tags.reduce((score, tag) => score + (rule.categoryBoosts[tag.toLowerCase()] ?? 0), 0);
  return place.score + (rule.categoryBoosts[bucket] ?? 0) + tagBoost + (place.isSponsored ? -8 : 0);
}

function uniquePlaces(places: NormalizedPlace[]): NormalizedPlace[] {
  const seen = new Set<string>();
  const result: NormalizedPlace[] = [];

  for (const place of places) {
    const key = `${place.provider}:${place.providerPlaceId ?? place.id}:${place.name}:${place.lat.toFixed(5)}:${place.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(place);
  }

  return result;
}

function orderByNearest(places: NormalizedPlace[]): NormalizedPlace[] {
  if (places.length <= 2) {
    return [...places];
  }

  const remaining = [...places];
  const ordered = [remaining.shift() as NormalizedPlace];

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1] as NormalizedPlace;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      if (!candidate) continue;
      const distance = haversineDistanceKm(
        { lat: current.lat, lng: current.lng },
        { lat: candidate.lat, lng: candidate.lng }
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    if (next) {
      ordered.push(next);
    }
  }

  return ordered;
}

function allocateDays(
  places: NormalizedPlace[],
  dayCount: number,
  rule: StyleRule
): NormalizedPlace[][] {
  const days: NormalizedPlace[][] = Array.from({ length: dayCount }, () => []);
  let dayIndex = 0;

  for (const place of places) {
    let currentDay = days[dayIndex];
    if (!currentDay) break;

    if (currentDay.length >= rule.maxPlacesPerDay && dayIndex < dayCount - 1) {
      dayIndex += 1;
      currentDay = days[dayIndex];
    }

    if (!currentDay) break;

    const lastPlace = currentDay[currentDay.length - 1];
    if (lastPlace && dayIndex < dayCount - 1) {
      const distanceFromLast = haversineDistanceKm(
        { lat: lastPlace.lat, lng: lastPlace.lng },
        { lat: place.lat, lng: place.lng }
      );

      if (distanceFromLast > rule.maxSameDayDistanceKm) {
        dayIndex += 1;
        currentDay = days[dayIndex];
      }
    }

    currentDay?.push(place);
  }

  return days;
}

function stayDurationMin(place: NormalizedPlace, rule: StyleRule): number {
  const bucket = categoryBucket(place);
  const base =
    bucket === "restaurant" ? 75 :
    bucket === "cafe" ? 45 :
    bucket === "lodging" ? 30 :
    bucket === "museum" || bucket === "history" ? 90 :
    75;

  return Math.max(30, base + rule.dwellAdjustmentMin);
}

function nextStartTime(cursorMin: number, place: NormalizedPlace): number {
  const bucket = categoryBucket(place);
  if (bucket === "restaurant" && cursorMin < 11 * 60 + 30) {
    return 11 * 60 + 30;
  }
  if (bucket === "cafe" && cursorMin < 14 * 60) {
    return 14 * 60;
  }
  if (bucket === "restaurant" && cursorMin > 15 * 60 && cursorMin < 17 * 60 + 30) {
    return 17 * 60 + 30;
  }
  return cursorMin;
}

function formatClock(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildTripPlaces(
  places: NormalizedPlace[],
  dayNumber: number,
  mode: TravelMode,
  rule: StyleRule
): TripPlacePlan[] {
  let cursor = 9 * 60;

  return places.map((place, index) => {
    cursor = nextStartTime(cursor, place);
    const duration = stayDurationMin(place, rule);
    const startTime = formatClock(cursor);
    const endTime = formatClock(cursor + duration);
    const nextPlace = places[index + 1];
    const routeToNext = nextPlace ? estimateSegment(place, nextPlace, mode) : undefined;
    const address = place.roadAddress ?? place.address;
    cursor += duration + (routeToNext?.durationMin ?? 0);

    return {
      id: `day-${dayNumber}-place-${index + 1}`,
      placeId: place.id,
      dayNumber,
      order: index + 1,
      startTime,
      endTime,
      title: place.name,
      category: place.category,
      stayDurationMin: duration,
      ...(address ? { address } : {}),
      ...(routeToNext ? { routeToNext } : {}),
      isSponsored: place.isSponsored,
      ...(place.sponsorLabel ? { sponsorLabel: place.sponsorLabel } : {})
    };
  });
}

function buildRouteSummary(days: TripDayPlan[], mode: TravelMode, warnings: string[]): RouteSummary {
  const segments = days.flatMap((day) =>
    day.places.map((place) => place.routeToNext).filter((segment): segment is NormalizedRouteSegment => Boolean(segment))
  );

  return {
    provider: "fallback",
    mode,
    totalDistanceKm: Math.round(segments.reduce((sum, segment) => sum + segment.distanceKm, 0) * 10) / 10,
    totalDurationMin: segments.reduce((sum, segment) => sum + segment.durationMin, 0),
    warnings
  };
}

export function generateTripPlan(input: TripPlanInput): TripPlanResult {
  const dayCount = getTripDayCount(input.startDate, input.endDate);
  const rule = STYLE_RULES[input.styleKey];
  const providerWarnings: ProviderWarning[] = [];

  if (input.places.length === 0) {
    providerWarnings.push({
      provider: "planner",
      code: "NO_PROVIDER_PLACES",
      message: "Provider 장소 데이터가 없어 빈 일정 초안을 반환합니다.",
      recoverable: true
    });
  }

  const selectedPlaces = orderByNearest(
    uniquePlaces(input.places)
      .sort((left, right) => placeScore(right, rule) - placeScore(left, rule))
      .slice(0, dayCount * rule.maxPlacesPerDay)
  );

  const allocatedDays = allocateDays(selectedPlaces, dayCount, rule);
  const days: TripDayPlan[] = allocatedDays.map((places, index) => {
    const dayNumber = index + 1;
    return {
      id: `day-${dayNumber}`,
      dayNumber,
      date: dateOffset(input.startDate, index),
      title: `${dayNumber}일차`,
      places: buildTripPlaces(places, dayNumber, input.mode, rule)
    };
  });

  const distanceWarning =
    selectedPlaces.length > 0 && days.some((day) => day.places.length === 0)
      ? ["일부 날짜에는 거리 제한과 장소 수 부족으로 배치된 장소가 없습니다."]
      : [];

  return {
    trip: {
      title: `${input.destination} 여행`,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      styleKey: input.styleKey
    },
    days,
    routeSummary: buildRouteSummary(days, input.mode, distanceWarning),
    providerWarnings,
    regenerationHints: [
      ...(providerWarnings.length > 0
        ? [{ code: "RETRY_PROVIDER_SEARCH", message: "추천 데이터를 다시 불러오면 장소 기반 일정표를 만들 수 있습니다.", severity: "warning" as const }]
        : []),
      ...(distanceWarning.length > 0
        ? [{ code: "ADD_MORE_PLACES", message: "비어 있는 날짜를 채우려면 장소를 더 담아주세요.", severity: "info" as const }]
        : [])
    ]
  };
}
