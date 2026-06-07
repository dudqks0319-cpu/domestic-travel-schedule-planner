import type { Env } from "../bindings";
import { fetchProvider, providerHttpError } from "./http";
import { safeTags, toNumber } from "./normalization";
import type { NormalizedPlace, PlaceProviderAdapter, PlaceProviderSearchInput, TravelMode } from "./types";

interface TourItem {
  contentid?: string;
  title?: string;
  addr1?: string;
  mapx?: string | number;
  mapy?: string | number;
  firstimage?: string;
  overview?: string;
  contenttypeid?: string;
}

interface TourResponse {
  response?: {
    body?: {
      items?: {
        item?: TourItem[] | TourItem;
      };
    };
  };
}

function contentTypeLabel(contentTypeId: string | undefined): string {
  if (contentTypeId === "12") return "관광지";
  if (contentTypeId === "14") return "문화시설";
  if (contentTypeId === "15") return "축제/행사";
  if (contentTypeId === "28") return "레포츠";
  if (contentTypeId === "38") return "쇼핑";
  if (contentTypeId === "39") return "맛집";
  return "관광";
}

export class TourPlaceAdapter implements PlaceProviderAdapter {
  readonly provider = "tour" as const;

  constructor(private readonly env: Env) {}

  async searchPlaces(input: PlaceProviderSearchInput): Promise<NormalizedPlace[]> {
    if (!this.env.DATA_GO_KR_API_KEY) {
      return [];
    }

    const url = new URL("https://apis.data.go.kr/B551011/KorService2/searchKeyword2");
    url.searchParams.set("serviceKey", this.env.DATA_GO_KR_API_KEY);
    url.searchParams.set("MobileOS", "ETC");
    url.searchParams.set("MobileApp", "TripMate");
    url.searchParams.set("_type", "json");
    url.searchParams.set("numOfRows", String(Math.min(input.limit ?? 10, 20)));
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("keyword", input.query);

    const response = await fetchProvider(url);
    if (!response.ok) throw providerHttpError(response);

    const data = await response.json<TourResponse>();
    const rawItems = data.response?.body?.items?.item;
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    return items.flatMap((item, index) => {
      const lat = toNumber(item.mapy);
      const lng = toNumber(item.mapx);
      if (!item.title || lat === null || lng === null) return [];
      const category = contentTypeLabel(item.contenttypeid);

      return [{
        id: `tour-${item.contentid ?? index}`,
        provider: this.provider,
        name: item.title,
        category,
        lat,
        lng,
        ...(item.contentid ? { providerPlaceId: item.contentid } : {}),
        ...(item.addr1 ? { address: item.addr1 } : {}),
        ...(item.firstimage ? { imageUrl: item.firstimage } : {}),
        ...(item.overview ? { description: item.overview } : {}),
        tags: safeTags(category),
        score: 70 - index,
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
