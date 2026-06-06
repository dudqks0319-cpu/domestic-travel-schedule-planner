import type { Env } from "../bindings";
import { safeTags, stripHtml, toNumber } from "./normalization";
import type { NormalizedPlace, PlaceProviderAdapter, PlaceProviderSearchInput, TravelMode } from "./types";

interface NaverLocalItem {
  title?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  mapx?: string;
  mapy?: string;
  link?: string;
  telephone?: string;
}

interface NaverLocalResponse {
  items?: NaverLocalItem[];
}

export class NaverPlaceAdapter implements PlaceProviderAdapter {
  readonly provider = "naver" as const;

  constructor(private readonly env: Env) {}

  async searchPlaces(input: PlaceProviderSearchInput): Promise<NormalizedPlace[]> {
    if (!this.env.NAVER_CLIENT_ID || !this.env.NAVER_CLIENT_SECRET) {
      return [];
    }

    const url = new URL("https://openapi.naver.com/v1/search/local.json");
    url.searchParams.set("query", input.query);
    url.searchParams.set("display", String(Math.min(input.limit ?? 10, 20)));
    url.searchParams.set("sort", "comment");

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": this.env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": this.env.NAVER_CLIENT_SECRET
      }
    });
    if (!response.ok) return [];

    const data = await response.json<NaverLocalResponse>();
    return (data.items ?? []).flatMap((item, index) => {
      const lng = toNumber(item.mapx) ? (toNumber(item.mapx) as number) / 10_000_000 : null;
      const lat = toNumber(item.mapy) ? (toNumber(item.mapy) as number) / 10_000_000 : null;
      const name = item.title ? stripHtml(item.title) : "";
      if (!name || lat === null || lng === null) return [];

      return [{
        id: `naver-${item.mapx ?? index}-${item.mapy ?? index}`,
        provider: this.provider,
        providerPlaceId: `${item.mapx ?? ""}:${item.mapy ?? ""}`,
        name,
        category: stripHtml(item.category ?? "장소"),
        lat,
        lng,
        ...(item.address ? { address: item.address } : {}),
        ...(item.roadAddress ? { roadAddress: item.roadAddress } : {}),
        ...(item.telephone ? { phone: item.telephone } : {}),
        ...(item.link ? { sourceUrl: item.link } : {}),
        tags: safeTags(item.category),
        score: 85 - index,
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
