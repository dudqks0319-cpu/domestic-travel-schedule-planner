import type { Env } from "../bindings";
import { fetchProvider, providerHttpError } from "./http";
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

interface NaverGeocodeAddress {
  roadAddress?: string;
  jibunAddress?: string;
  x?: string;
  y?: string;
}

interface NaverGeocodeResponse {
  status?: string;
  addresses?: NaverGeocodeAddress[];
}

interface NaverReverseRegionArea {
  name?: string;
}

interface NaverReverseLand {
  name?: string;
  number1?: string;
  number2?: string;
  addition0?: {
    type?: string;
    value?: string;
  };
}

interface NaverReverseResult {
  name?: string;
  region?: {
    area1?: NaverReverseRegionArea;
    area2?: NaverReverseRegionArea;
    area3?: NaverReverseRegionArea;
    area4?: NaverReverseRegionArea;
  };
  land?: NaverReverseLand;
}

interface NaverReverseGeocodeResponse {
  status?: {
    code?: number;
    name?: string;
    message?: string;
  };
  results?: NaverReverseResult[];
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

function naverSearchClientId(env: Env): string | undefined {
  return env.NAVER_SEARCH_CLIENT_ID ?? env.NAVER_CLIENT_ID;
}

function naverSearchClientSecret(env: Env): string | undefined {
  return env.NAVER_SEARCH_CLIENT_SECRET ?? env.NAVER_CLIENT_SECRET;
}

export function naverMapsClientId(env: Env): string | undefined {
  return env.NAVER_MAPS_CLIENT_ID ?? env.NAVER_CLIENT_ID;
}

export function naverMapsClientSecret(env: Env): string | undefined {
  return env.NAVER_MAPS_CLIENT_SECRET ?? env.NAVER_CLIENT_SECRET;
}

export function hasNaverMapsCredentials(env: Env): boolean {
  return Boolean(naverMapsClientId(env) && naverMapsClientSecret(env));
}

function naverCloudHeaders(env: Env): Record<string, string> {
  return {
    "x-ncp-apigw-api-key-id": naverMapsClientId(env) ?? "",
    "x-ncp-apigw-api-key": naverMapsClientSecret(env) ?? ""
  };
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

function reverseAddress(result: NaverReverseResult): string | null {
  const region = [
    result.region?.area1?.name,
    result.region?.area2?.name,
    result.region?.area3?.name,
    result.region?.area4?.name
  ].filter(Boolean);
  const land = result.land;
  const number = [land?.number1, land?.number2].filter(Boolean).join("-");
  const roadOrLand = [land?.name, number].filter(Boolean).join(" ");
  const building = land?.addition0?.type === "building" ? land.addition0.value : undefined;
  const address = [...region, roadOrLand, building].filter(Boolean).join(" ").trim();
  return address || null;
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
    const clientId = naverSearchClientId(this.env);
    const clientSecret = naverSearchClientSecret(this.env);
    if (!clientId || !clientSecret) {
      return [];
    }

    const url = new URL("https://openapi.naver.com/v1/search/local.json");
    url.searchParams.set("query", input.query);
    url.searchParams.set("display", String(Math.min(input.limit ?? 10, 20)));
    url.searchParams.set("sort", "comment");

    const response = await fetchProvider(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret
      }
    });
    if (!response.ok) throw providerHttpError(response);

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

  async geocode(input: { address: string }): Promise<{ lat: number; lng: number } | null> {
    if (!hasNaverMapsCredentials(this.env) || !input.address.trim()) {
      return null;
    }

    const url = new URL("https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode");
    url.searchParams.set("query", input.address.trim());

    const response = await fetchProvider(url, {
      headers: naverCloudHeaders(this.env)
    });
    if (!response.ok) throw providerHttpError(response);

    const data = await response.json<NaverGeocodeResponse>();
    if (data.status && data.status !== "OK") {
      return null;
    }

    const first = data.addresses?.[0];
    const lat = toNumber(first?.y);
    const lng = toNumber(first?.x);
    return lat === null || lng === null ? null : { lat, lng };
  }

  async reverseGeocode(input: { lat: number; lng: number }): Promise<{ address: string } | null> {
    if (!hasNaverMapsCredentials(this.env)) {
      return null;
    }

    const url = new URL("https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc");
    url.searchParams.set("request", "coordsToaddr");
    url.searchParams.set("coords", coordinate(input));
    url.searchParams.set("sourcecrs", "epsg:4326");
    url.searchParams.set("orders", "roadaddr,addr,legalcode,admcode");
    url.searchParams.set("output", "json");

    const response = await fetchProvider(url, {
      headers: naverCloudHeaders(this.env)
    });
    if (!response.ok) throw providerHttpError(response);

    const data = await response.json<NaverReverseGeocodeResponse>();
    if (data.status?.code !== undefined && data.status.code !== 0) {
      return null;
    }

    const preferred = data.results?.find((result) => result.name === "roadaddr")
      ?? data.results?.find((result) => result.name === "addr")
      ?? data.results?.[0];
    const address = preferred ? reverseAddress(preferred) : null;
    return address ? { address } : null;
  }

  async getDirections(input: {
    points: Array<{ id?: string; lat: number; lng: number; name?: string }>;
    mode: TravelMode;
  }): Promise<NormalizedRoute | null> {
    if (!hasNaverMapsCredentials(this.env) || input.mode !== "driving") {
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
      headers: naverCloudHeaders(this.env)
    });
    if (!response.ok) throw providerHttpError(response);

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
