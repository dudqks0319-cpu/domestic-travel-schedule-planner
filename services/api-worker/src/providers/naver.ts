import type { Env } from "../bindings";
import { fetchProvider } from "./http";
import { safeTags, stripHtml, toNumber } from "./normalization";
import type {
  NormalizedPlace,
  NormalizedRoute,
  PlaceProviderAdapter,
  PlaceProviderSearchInput,
  TravelMode
} from "./types";

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

interface NaverDirectionsPath {
  summary?: {
    distance?: number;
    duration?: number;
  };
}

interface NaverDirectionsResponse {
  code?: number;
  message?: string;
  route?: {
    traoptimal?: NaverDirectionsPath[];
  };
}

function coordinate(point: { lat: number; lng: number }): string {
  return `${point.lng},${point.lat}`;
}

function pointLabel(point: { id?: string; name?: string }, index: number): string {
  return point.id ?? point.name ?? `point-${index + 1}`;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function straightDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const radiusKm = 6371;
  const latDiff = toRad(to.lat - from.lat);
  const lngDiff = toRad(to.lng - from.lng);
  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(lngDiff / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function metersToKm(value: number | undefined): number {
  if (!value || value < 0) return 0;
  return Math.round((value / 1000) * 10) / 10;
}

function millisecondsToMin(value: number | undefined): number {
  if (!value || value < 0) return 0;
  return Math.max(1, Math.round(value / 60_000));
}

function allocateSegments(
  points: Array<{ id?: string; lat: number; lng: number; name?: string }>,
  totalDistanceKm: number,
  totalDurationMin: number
): NormalizedRoute["segments"] {
  const straightDistances = points.slice(0, -1).map((from, index) => {
    const to = points[index + 1]!;
    return straightDistanceKm(from, to);
  });
  const straightTotal = straightDistances.reduce((sum, distance) => sum + distance, 0);

  return straightDistances.map((distance, index) => {
    const ratio = straightTotal > 0 ? distance / straightTotal : 1 / straightDistances.length;
    const from = points[index]!;
    const to = points[index + 1]!;
    return {
      from: pointLabel(from, index),
      to: pointLabel(to, index + 1),
      distanceKm: Math.max(0.1, Math.round(totalDistanceKm * ratio * 10) / 10),
      durationMin: Math.max(1, Math.round(totalDurationMin * ratio)),
      provider: "naver" as const
    };
  });
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

    const response = await fetchProvider(url, {
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

  async getDirections(input: {
    points: Array<{ id?: string; lat: number; lng: number; name?: string }>;
    mode: TravelMode;
  }): Promise<NormalizedRoute | null> {
    if (!this.env.NAVER_CLIENT_ID || !this.env.NAVER_CLIENT_SECRET || input.mode !== "driving") {
      return null;
    }
    if (input.points.length < 2 || input.points.length > 7) {
      return null;
    }

    const start = input.points[0];
    const goal = input.points[input.points.length - 1];
    const waypoints = input.points.slice(1, -1);
    if (!start || !goal) {
      return null;
    }

    const url = new URL("https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving");
    url.searchParams.set("start", coordinate(start));
    url.searchParams.set("goal", coordinate(goal));
    url.searchParams.set("option", "traoptimal");
    if (waypoints.length) {
      url.searchParams.set("waypoints", waypoints.map(coordinate).join("|"));
    }

    const response = await fetchProvider(url, {
      headers: {
        "x-ncp-apigw-api-key-id": this.env.NAVER_CLIENT_ID,
        "x-ncp-apigw-api-key": this.env.NAVER_CLIENT_SECRET
      }
    });
    if (!response.ok) return null;

    const data = await response.json<NaverDirectionsResponse>();
    if (data.code !== undefined && data.code !== 0) {
      return null;
    }

    const summary = data.route?.traoptimal?.[0]?.summary;
    const totalDistanceKm = metersToKm(summary?.distance);
    const totalDurationMin = millisecondsToMin(summary?.duration);
    if (totalDistanceKm <= 0 || totalDurationMin <= 0) {
      return null;
    }

    return {
      provider: "naver",
      mode: "driving",
      orderedPoints: input.points,
      segments: allocateSegments(input.points, totalDistanceKm, totalDurationMin),
      totalDistanceKm,
      totalDurationMin,
      warnings: waypoints.length
        ? ["네이버 길찾기는 총 경로 결과를 기준으로 경유지별 이동시간을 비례 배분했습니다."]
        : []
    };
  }
}
