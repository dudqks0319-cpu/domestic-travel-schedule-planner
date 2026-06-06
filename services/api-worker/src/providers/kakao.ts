import type { Env } from "../bindings";
import { safeTags, toNumber } from "./normalization";
import type { NormalizedPlace, PlaceProviderAdapter, PlaceProviderSearchInput, TravelMode } from "./types";

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

    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${this.env.KAKAO_REST_API_KEY}` }
    });
    if (!response.ok) return [];

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

  async geocode(): Promise<{ lat: number; lng: number } | null> {
    return null;
  }

  async reverseGeocode(): Promise<{ address: string } | null> {
    return null;
  }

  async getDirections(_input: { points: Array<{ lat: number; lng: number; name?: string }>; mode: TravelMode }) {
    return null;
  }
}
