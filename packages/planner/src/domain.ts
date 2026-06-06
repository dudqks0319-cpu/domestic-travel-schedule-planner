export type ProviderKind = "naver" | "kakao" | "tour" | "manual";

export type RouteProviderKind = "naver" | "kakao" | "fallback" | "mixed";

export type TravelMode = "driving" | "transit" | "walking";

export type TravelStyleKey =
  | "sea_cafe_food"
  | "food_focused"
  | "history_walk"
  | "family_easy"
  | "rainy_backup"
  | "walker_transit"
  | "drive_trip"
  | "parents_comfort"
  | "pet_friendly";

export interface PlaceProviderSearchInput {
  query: string;
  lat?: number;
  lng?: number;
  radius?: number;
  category?: string;
  limit?: number;
}

export interface NormalizedPlace {
  id: string;
  provider: ProviderKind;
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
  provider: Exclude<RouteProviderKind, "mixed">;
}

export interface NormalizedRoute {
  provider: RouteProviderKind;
  mode: TravelMode;
  orderedPoints: NormalizedRoutePoint[];
  segments: NormalizedRouteSegment[];
  totalDistanceKm: number;
  totalDurationMin: number;
  warnings: string[];
}

export interface ProviderWarning {
  provider: ProviderKind | RouteProviderKind | "planner";
  code: string;
  message: string;
  recoverable: boolean;
}

export interface TripPlanInput {
  destination: string;
  startDate: string;
  endDate: string;
  styleKey: TravelStyleKey;
  mode: TravelMode;
  companions?: string;
  accommodationAddress?: string;
  preferredKeywords?: string[];
  excludedKeywords?: string[];
  places: NormalizedPlace[];
}

export interface TripPlacePlan {
  id: string;
  placeId?: string;
  dayNumber: number;
  order: number;
  startTime: string;
  endTime?: string;
  title: string;
  category: string;
  address?: string;
  memo?: string;
  stayDurationMin: number;
  routeToNext?: NormalizedRouteSegment;
  isSponsored: boolean;
  sponsorLabel?: string;
}

export interface TripDayPlan {
  id: string;
  dayNumber: number;
  date: string;
  title: string;
  places: TripPlacePlan[];
}

export interface RouteSummary {
  provider: RouteProviderKind;
  mode: TravelMode;
  totalDistanceKm: number;
  totalDurationMin: number;
  warnings: string[];
}

export interface RegenerationHint {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface TripPlanResult {
  trip: {
    id?: string;
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    styleKey: TravelStyleKey;
  };
  days: TripDayPlan[];
  routeSummary: RouteSummary;
  providerWarnings: ProviderWarning[];
  regenerationHints: RegenerationHint[];
}

export interface PlaceProviderAdapter {
  searchPlaces(input: PlaceProviderSearchInput): Promise<NormalizedPlace[]>;
  geocode(input: { address: string }): Promise<{ lat: number; lng: number } | null>;
  reverseGeocode(input: { lat: number; lng: number }): Promise<{ address: string } | null>;
  getDirections(input: {
    points: Array<{ lat: number; lng: number; name?: string }>;
    mode: TravelMode;
  }): Promise<NormalizedRoute | null>;
}
