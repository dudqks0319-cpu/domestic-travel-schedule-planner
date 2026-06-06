export type ProviderKind = "naver" | "kakao" | "tour" | "manual";
export type RouteProviderKind = "naver" | "kakao" | "fallback" | "mixed";
export type TravelMode = "driving" | "transit" | "walking";

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

export interface NormalizedRoute {
  provider: RouteProviderKind;
  mode: TravelMode;
  orderedPoints: Array<{ id?: string; name?: string; lat: number; lng: number }>;
  segments: Array<{
    from: string;
    to: string;
    distanceKm: number;
    durationMin: number;
    provider: Exclude<RouteProviderKind, "mixed">;
  }>;
  totalDistanceKm: number;
  totalDurationMin: number;
  warnings: string[];
}

export interface PlaceProviderAdapter {
  readonly provider: ProviderKind;
  searchPlaces(input: PlaceProviderSearchInput): Promise<NormalizedPlace[]>;
  geocode(input: { address: string }): Promise<{ lat: number; lng: number } | null>;
  reverseGeocode(input: { lat: number; lng: number }): Promise<{ address: string } | null>;
  getDirections(input: {
    points: Array<{ id?: string; lat: number; lng: number; name?: string }>;
    mode: TravelMode;
  }): Promise<NormalizedRoute | null>;
}

export interface ProviderSearchResult {
  places: NormalizedPlace[];
  warnings: string[];
  cacheStatus: "hit" | "miss" | "skipped";
}
