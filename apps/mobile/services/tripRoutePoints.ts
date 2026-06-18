import type { CompanionType, CurrentTripStorage, TransportType } from "../types";
import { resolveTravelStyleKey } from "../constants/travelStyles";
import { canUseMockMapPreview, isProductionRuntime } from "./mapProvider";
import type { RoutePoint, RouteTransportMode } from "./routeApi";

interface TripMeta {
  destination: string;
  startDate: string;
  endDate: string;
}

interface ParsedTripRouteState {
  meta: TripMeta;
  points: RoutePoint[];
  mode: RouteTransportMode | null;
  warnings: string[];
  hasMockPreviewPoints: boolean;
}

const DESTINATION_CENTERS: Record<string, { lat: number; lng: number }> = {
  제주: { lat: 33.4996, lng: 126.5312 },
  부산: { lat: 35.1796, lng: 129.0756 },
  서울: { lat: 37.5665, lng: 126.978 },
  강릉: { lat: 37.7519, lng: 128.8761 },
  여수: { lat: 34.7604, lng: 127.6622 },
  경주: { lat: 35.8562, lng: 129.2247 },
  전주: { lat: 35.8242, lng: 127.148 },
  인천: { lat: 37.4563, lng: 126.7052 },
  속초: { lat: 38.207, lng: 128.5918 },
  포항: { lat: 36.019, lng: 129.3435 }
};

const MOCK_POINT_OFFSETS = [
  { lat: 0, lng: 0 },
  { lat: 0.014, lng: 0.012 },
  { lat: -0.011, lng: 0.017 },
  { lat: -0.016, lng: -0.01 },
  { lat: 0.013, lng: -0.016 },
  { lat: 0.006, lng: 0.022 }
];

const LEGACY_SYNTHETIC_NAME_PATTERN = /(출발|마무리|도착|추천 스팟|추천 명소|추천 맛집|식당)$/;

const ATTRACTION_LABELS: Record<string, string> = {
  nature: "자연/풍경",
  museum: "박물관",
  theme_park: "테마파크",
  market: "시장/쇼핑",
  night_view: "야경 명소",
  walk_course: "산책 코스",
  kids_zone: "키즈 스팟",
  culture: "공연/문화"
};

const RESTAURANT_LABELS: Record<string, string> = {
  korean: "한식",
  seafood: "해산물",
  bbq: "고기집",
  noodle: "면요리",
  cafe: "카페",
  dessert: "디저트",
  night_food: "야식",
  local: "로컬 맛집"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeMode(value: unknown): RouteTransportMode | null {
  if (value === "car" || value === "driving") return "driving";
  if (value === "transit" || value === "public") return "transit";
  if (value === "walk" || value === "walking") return "walking";
  return null;
}

function normalizeCompanion(value: unknown): CompanionType | null {
  if (
    value === "solo" ||
    value === "friends" ||
    value === "couple" ||
    value === "family_kids" ||
    value === "family_no_kids" ||
    value === "parents"
  ) {
    return value;
  }

  return null;
}

function normalizeTransport(value: unknown): TransportType | null {
  if (value === "car" || value === "transit" || value === "walk") {
    return value;
  }

  return null;
}

function parseTripMeta(rawTrip: unknown): TripMeta {
  if (!isRecord(rawTrip)) {
    return { destination: "여행", startDate: "", endDate: "" };
  }

  return {
    destination:
      typeof rawTrip.destination === "string" && rawTrip.destination.trim().length > 0
        ? rawTrip.destination
        : "여행",
    startDate: typeof rawTrip.startDate === "string" ? rawTrip.startDate : "",
    endDate: typeof rawTrip.endDate === "string" ? rawTrip.endDate : ""
  };
}

function resolveDestinationCenter(destination: string): { lat: number; lng: number } {
  const normalized = destination.trim();
  const entry = Object.entries(DESTINATION_CENTERS).find(([name]) => normalized.includes(name));
  return entry?.[1] ?? { lat: 37.5665, lng: 126.978 };
}

function toRoutePoint(raw: unknown, index: number): RoutePoint | null {
  if (!isRecord(raw)) {
    return null;
  }

  const lat = toFiniteNumber(raw.lat ?? raw.latitude);
  const lng = toFiniteNumber(raw.lng ?? raw.lon ?? raw.longitude);

  if (lat === null || lng === null) {
    return null;
  }

  const id = typeof raw.id === "string" ? raw.id : `trip-point-${index + 1}`;
  const name = typeof raw.name === "string" ? raw.name : `방문 지점 ${index + 1}`;
  const source = raw.source === "mock" || raw.source === "provider" || raw.source === "manual" ? raw.source : "manual";

  return { id, name, lat, lng, source };
}

function hasOnlyLegacySyntheticNames(points: RoutePoint[]): boolean {
  return points.length > 0 && points.every((point) => LEGACY_SYNTHETIC_NAME_PATTERN.test(point.name ?? ""));
}

function buildMockRoutePointsFromTrip(trip: CurrentTripStorage): RoutePoint[] {
  const safeDestination = trip.destination.trim() || "여행지";
  const center = resolveDestinationCenter(safeDestination);
  const attractionNames = trip.attractions
    .slice(0, 3)
    .map((key, index) => `${safeDestination} ${ATTRACTION_LABELS[key] ?? `추천 명소 ${index + 1}`}`);
  const restaurantNames = trip.restaurants
    .slice(0, 2)
    .map((key, index) => `${safeDestination} ${RESTAURANT_LABELS[key] ?? `추천 맛집 ${index + 1}`}`);
  const maxIntermediateCount = Math.max(0, MOCK_POINT_OFFSETS.length - 2);
  const intermediateNames = [...attractionNames, ...restaurantNames].slice(0, maxIntermediateCount);
  const names = [`${safeDestination} 출발`, ...intermediateNames, `${safeDestination} 마무리`];

  if (intermediateNames.length === 0) {
    names.splice(1, 0, `${safeDestination} 추천 스팟`);
  }

  return names.slice(0, MOCK_POINT_OFFSETS.length).map((name, index) => ({
    id: `mock-point-${index + 1}`,
    name,
    lat: center.lat + MOCK_POINT_OFFSETS[index].lat,
    lng: center.lng + MOCK_POINT_OFFSETS[index].lng,
    source: "mock"
  }));
}

function toCurrentTripStorage(rawTrip: unknown): CurrentTripStorage | null {
  if (!isRecord(rawTrip)) {
    return null;
  }

  const meta = parseTripMeta(rawTrip);
  return {
    id: typeof rawTrip.id === "string" ? rawTrip.id : "current-trip",
    title: typeof rawTrip.title === "string" ? rawTrip.title : `${meta.destination} 여행`,
    destination: meta.destination,
    startDate: meta.startDate,
    endDate: meta.endDate,
    styleKey: resolveTravelStyleKey(typeof rawTrip.styleKey === "string" ? rawTrip.styleKey : undefined),
    companion: normalizeCompanion(rawTrip.companion),
    transport: normalizeTransport(rawTrip.transport),
    accommodationType: typeof rawTrip.accommodationType === "string" ? rawTrip.accommodationType : null,
    attractions: normalizeStringArray(rawTrip.attractions),
    restaurants: normalizeStringArray(rawTrip.restaurants),
    routePoints: Array.isArray(rawTrip.routePoints) ? rawTrip.routePoints : [],
    createdAt: typeof rawTrip.createdAt === "string" ? rawTrip.createdAt : new Date().toISOString()
  };
}

export function parseCurrentTripRouteState(rawTrip: unknown): ParsedTripRouteState {
  const trip = toCurrentTripStorage(rawTrip);

  if (!trip) {
    return {
      meta: parseTripMeta(rawTrip),
      points: [],
      mode: null,
      warnings: ["저장된 여행 정보가 없어 경로를 만들 수 없습니다."],
      hasMockPreviewPoints: false
    };
  }

  const storedPoints = trip.routePoints
    .map((point, index) => toRoutePoint(point, index))
    .filter((point): point is RoutePoint => point !== null);
  const usableStoredPoints =
    storedPoints.length >= 2 && !hasOnlyLegacySyntheticNames(storedPoints) ? storedPoints : [];

  if (usableStoredPoints.length >= 2) {
    return {
      meta: parseTripMeta(trip),
      points: usableStoredPoints,
      mode: normalizeMode(trip.transport),
      warnings: [],
      hasMockPreviewPoints: usableStoredPoints.some((point) => point.source === "mock")
    };
  }

  if (!canUseMockMapPreview()) {
    return {
      meta: parseTripMeta(trip),
      points: [],
      mode: normalizeMode(trip.transport),
      warnings: [
        isProductionRuntime()
          ? "운영 환경에서는 provider 좌표가 없는 여행을 mock 좌표로 표시하지 않습니다."
          : "mock route preview가 비활성화되어 경로 좌표를 표시하지 않습니다."
      ],
      hasMockPreviewPoints: false
    };
  }

  return {
    meta: parseTripMeta(trip),
    points: buildMockRoutePointsFromTrip(trip),
    mode: normalizeMode(trip.transport),
    warnings: ["provider 좌표가 아직 없어 개발용 mock 좌표로 경로 미리보기를 표시합니다."],
    hasMockPreviewPoints: true
  };
}
