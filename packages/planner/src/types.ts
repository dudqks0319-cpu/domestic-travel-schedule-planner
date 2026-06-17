export const TRAVEL_STYLE_KEYS = [
  "sea_cafe_food",
  "food_focused",
  "history_walk",
  "with_kids",
  "rainy_day",
  "walking_trip",
  "drive_trip",
  "with_parents",
  "pet_friendly"
] as const;

export type TravelStyleKey = (typeof TRAVEL_STYLE_KEYS)[number];

export const DEFAULT_TRAVEL_STYLE_KEY: TravelStyleKey = "sea_cafe_food";

export type PlaceProvider = "naver" | "kakao" | "tour" | "manual";

export type RouteProvider = "naver" | "kakao" | "fallback" | "mixed";

export type RouteSegmentProvider = "naver" | "kakao" | "fallback";

export type TravelTransportMode = "driving" | "transit" | "walking";

export type TripCompanionKey =
  | "solo"
  | "friends"
  | "couple"
  | "family_kids"
  | "family_no_kids"
  | "parents";

export interface NormalizedPlace {
  id: string;
  provider: PlaceProvider;
  providerPlaceId?: string;
  name: string;
  category: string;
  address?: string;
  roadAddress?: string;
  lat: number;
  lng: number;
  phone?: string;
  imageUrl?: string;
  sourceUrl?: string;
  description?: string;
  tags: string[];
  score: number;
  isSponsored: boolean;
  sponsorLabel?: string;
}

export interface NormalizedRoutePoint {
  id?: string;
  name?: string;
  lat: number;
  lng: number;
}

export interface NormalizedRouteSegment {
  from: string;
  to: string;
  distanceKm: number;
  durationMin: number;
  provider: RouteSegmentProvider;
}

export interface NormalizedRoute {
  provider: RouteProvider;
  mode: TravelTransportMode;
  orderedPoints: NormalizedRoutePoint[];
  segments: NormalizedRouteSegment[];
  totalDistanceKm: number;
  totalDurationMin: number;
  warnings: string[];
}

export interface TripPlanInput {
  regionName: string;
  startDate: string;
  endDate: string;
  styleKey: TravelStyleKey;
  transportMode?: TravelTransportMode;
  companionType?: TripCompanionKey;
  accommodationAddress?: string;
  preferenceKeywords?: string[];
  excludedKeywords?: string[];
}

export interface TripPlace {
  id: string;
  placeId: string;
  name: string;
  category: string;
  startsAt?: string;
  endsAt?: string;
  stayDurationMin: number;
  memo?: string;
  routeFromPrevious?: NormalizedRouteSegment;
  place: NormalizedPlace;
}

export interface TripDay {
  id: string;
  dayNumber: number;
  date: string;
  places: TripPlace[];
}

export interface RouteSummary {
  route: NormalizedRoute | null;
  warnings: string[];
}

export interface ProviderWarning {
  provider: PlaceProvider | RouteProvider;
  code: string;
  message: string;
  recoverable: boolean;
}

export interface TripPlanResult {
  tripId?: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  styleKey: TravelStyleKey;
  days: TripDay[];
  routeSummary: RouteSummary;
  providerWarnings: ProviderWarning[];
  regenerationHints: string[];
}

export function isTravelStyleKey(value: unknown): value is TravelStyleKey {
  return typeof value === "string" && (TRAVEL_STYLE_KEYS as readonly string[]).includes(value);
}

export function normalizeTravelStyleKey(value: unknown): TravelStyleKey {
  return isTravelStyleKey(value) ? value : DEFAULT_TRAVEL_STYLE_KEY;
}
