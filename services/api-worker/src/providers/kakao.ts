import type { Env } from "../bindings";
import { fetchProvider, providerHttpError } from "./http";
import { safeTags, toNumber } from "./normalization";
import type {
  NormalizedPlace,
  NormalizedRoute,
  PlaceProviderAdapter,
  PlaceProviderSearchInput,
  TravelMode
} from "./types";

interface KakaoDocument {
  id?: string;
  place_name?: string;
  category_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
  phone?: string;
  place_url?: string;
}

interface KakaoKeywordResponse {
  documents?: KakaoDocument[];
}

interface KakaoAddressDocument {
  address_name?: string;
  x?: string;
  y?: string;
}

interface KakaoAddressResponse {
  documents?: KakaoAddressDocument[];
}

interface KakaoReverseAddressDocument {
  address?: {
    address_name?: string;
  };
  road_address?: {
    address_name?: string;
  };
}

interface KakaoReverseAddressResponse {
  documents?: KakaoReverseAddressDocument[];
}

interface KakaoDirectionsSection {
  distance?: number;
  duration?: number;
}

interface KakaoDirectionsRoute {
  result_code?: number;
  result_msg?: string;
  summary?: {
    distance?: number;
    duration?: number;
  };
  sections?: KakaoDirectionsSection[];
}

interface KakaoDirectionsResponse {
  routes?: KakaoDirectionsRoute[];
}

function coordinate(point: { lat: number; lng: number }): string {
  return `${point.lng},${point.lat}`;
}

function pointLabel(point: { id?: string; name?: string }, index: number): string {
  return point.id ?? point.name ?? `point-${index + 1}`;
}

function metersToKm(value: number | undefined): number {
  if (!value || value < 0) return 0;
  return Math.round((value / 1000) * 10) / 10;
}

function secondsToMin(value: number | undefined): number {
  if (!value || value < 0) return 0;
  return Math.max(1, Math.round(value / 60));
}

export class KakaoPlaceAdapter implements PlaceProviderAdapter {
  readonly provider = "kakao" as const;

  constructor(private readonly env: Env) {}

  async searchPlaces(input: PlaceProviderSearchInput): Promise<NormalizedPlace[]> {
    if (!this.env.KAKAO_REST_API_KEY) {
      return [];
    }

    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.searchParams.set("query", input.query);
    url.searchParams.set("size", String(Math.min(input.limit ?? 10, 15)));
    if (input.lat !== undefined && input.lng !== undefined) {
      url.searchParams.set("y", String(input.lat));
      url.searchParams.set("x", String(input.lng));
      url.searchParams.set("radius", String(Math.min(input.radius ?? 20_000, 20_000)));
    }

    const response = await fetchProvider(url, {
      headers: { Authorization: `KakaoAK ${this.env.KAKAO_REST_API_KEY}` }
    });
    if (!response.ok) throw providerHttpError(response);

    const data = await response.json<KakaoKeywordResponse>();
    return (data.documents ?? []).flatMap((item, index) => {
      const lat = toNumber(item.y);
      const lng = toNumber(item.x);
      if (!item.place_name || lat === null || lng === null) return [];

      return [{
        id: `kakao-${item.id ?? index}`,
        provider: this.provider,
        name: item.place_name,
        category: item.category_name ?? "장소",
        lat,
        lng,
        ...(item.id ? { providerPlaceId: item.id } : {}),
        ...(item.address_name ? { address: item.address_name } : {}),
        ...(item.road_address_name ? { roadAddress: item.road_address_name } : {}),
        ...(item.phone ? { phone: item.phone } : {}),
        ...(item.place_url ? { sourceUrl: item.place_url } : {}),
        tags: safeTags(item.category_name),
        score: 78 - index,
        isSponsored: false
      }];
    });
  }

  async geocode(input: { address: string }): Promise<{ lat: number; lng: number } | null> {
    if (!this.env.KAKAO_REST_API_KEY || !input.address.trim()) {
      return null;
    }

    const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
    url.searchParams.set("query", input.address.trim());

    const response = await fetchProvider(url, {
      headers: { Authorization: `KakaoAK ${this.env.KAKAO_REST_API_KEY}` }
    });
    if (!response.ok) throw providerHttpError(response);

    const data = await response.json<KakaoAddressResponse>();
    const first = data.documents?.[0];
    const lat = toNumber(first?.y);
    const lng = toNumber(first?.x);

    return lat === null || lng === null ? null : { lat, lng };
  }

  async reverseGeocode(input: { lat: number; lng: number }): Promise<{ address: string } | null> {
    if (!this.env.KAKAO_REST_API_KEY) {
      return null;
    }

    const url = new URL("https://dapi.kakao.com/v2/local/geo/coord2address.json");
    url.searchParams.set("x", String(input.lng));
    url.searchParams.set("y", String(input.lat));
    url.searchParams.set("input_coord", "WGS84");

    const response = await fetchProvider(url, {
      headers: { Authorization: `KakaoAK ${this.env.KAKAO_REST_API_KEY}` }
    });
    if (!response.ok) throw providerHttpError(response);

    const data = await response.json<KakaoReverseAddressResponse>();
    const first = data.documents?.[0];
    const address = first?.road_address?.address_name ?? first?.address?.address_name;

    return address ? { address } : null;
  }

  async getDirections(input: {
    points: Array<{ id?: string; lat: number; lng: number; name?: string }>;
    mode: TravelMode;
  }): Promise<NormalizedRoute | null> {
    if (!this.env.KAKAO_REST_API_KEY || input.mode !== "driving" || input.points.length < 2) {
      return null;
    }
    if (input.points.length > 7) {
      return null;
    }

    const origin = input.points[0];
    const destination = input.points[input.points.length - 1];
    const waypoints = input.points.slice(1, -1);
    if (!origin || !destination) {
      return null;
    }

    const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
    url.searchParams.set("origin", coordinate(origin));
    url.searchParams.set("destination", coordinate(destination));
    if (waypoints.length) {
      url.searchParams.set("waypoints", waypoints.map(coordinate).join("|"));
    }
    url.searchParams.set("summary", "false");

    const response = await fetchProvider(url, {
      headers: { Authorization: `KakaoAK ${this.env.KAKAO_REST_API_KEY}` }
    });
    if (!response.ok) throw providerHttpError(response);

    const data = await response.json<KakaoDirectionsResponse>();
    const route = data.routes?.[0];
    if (!route || (route.result_code !== undefined && route.result_code !== 0)) {
      return null;
    }

    const sections = route.sections ?? [];
    if (sections.length !== input.points.length - 1) {
      return null;
    }

    const segments = sections.map((section, index) => {
      const from = input.points[index]!;
      const to = input.points[index + 1]!;
      return {
        from: pointLabel(from, index),
        to: pointLabel(to, index + 1),
        distanceKm: metersToKm(section.distance),
        durationMin: secondsToMin(section.duration),
        provider: "kakao" as const
      };
    });

    const totalDistanceKm = route.summary?.distance
      ? metersToKm(route.summary.distance)
      : Math.round(segments.reduce((sum, segment) => sum + segment.distanceKm, 0) * 10) / 10;
    const totalDurationMin = route.summary?.duration
      ? secondsToMin(route.summary.duration)
      : segments.reduce((sum, segment) => sum + segment.durationMin, 0);

    return {
      provider: "kakao",
      mode: "driving",
      orderedPoints: input.points,
      segments,
      totalDistanceKm,
      totalDurationMin,
      warnings: []
    };
  }
}
