export type RouteTransportMode = "driving" | "transit" | "walking";
export type RouteEstimateProvider = "kakao" | "odsay" | "fallback";

export interface RoutePoint {
  id?: string;
  name?: string;
  lat: number;
  lng: number;
}

export interface OptimizeRouteInput {
  start: RoutePoint;
  waypoints: RoutePoint[];
  end?: RoutePoint;
  roundTrip: boolean;
  mode: RouteTransportMode;
}

export interface RouteSegmentEstimate {
  from: RoutePoint;
  to: RoutePoint;
  distanceKm: number;
  durationMin: number;
  provider: RouteEstimateProvider;
}

export interface OptimizeRouteResult {
  orderedPoints: RoutePoint[];
  segments: RouteSegmentEstimate[];
  totalDistanceKm: number;
  totalDurationMin: number;
  source: RouteEstimateProvider | "mixed";
  warnings: string[];
}

interface ProviderKeys {
  kakaoKey?: string;
  odsayKey?: string;
}

interface RawEstimate {
  distanceKm: number;
  durationMin: number;
  provider: RouteEstimateProvider;
}

function clonePoint(point: RoutePoint): RoutePoint {
  return {
    id: point.id,
    name: point.name,
    lat: point.lat,
    lng: point.lng
  };
}

function resolveProviderKeys(): ProviderKeys {
  const kakao =
    process.env.KAKAO_REST_API_KEY ??
    process.env.KAKAO_API_KEY ??
    process.env.KAKAO_KEY;
  const odsay = process.env.ODSAY_API_KEY ?? process.env.ODSAY_KEY;

  return {
    kakaoKey: kakao?.trim() || undefined,
    odsayKey: odsay?.trim() || undefined
  };
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function haversineKm(from: RoutePoint, to: RoutePoint): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function orderWaypointsByDistance(start: RoutePoint, waypoints: RoutePoint[]): RoutePoint[] {
  const remaining = waypoints.map(clonePoint);
  const ordered: RoutePoint[] = [];
  let current = start;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const distance = haversineKm(current, remaining[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    const [nextPoint] = remaining.splice(bestIndex, 1);
    ordered.push(nextPoint);
    current = nextPoint;
  }

  return ordered;
}

function getFallbackSpeedKmh(mode: RouteTransportMode): number {
  if (mode === "walking") {
    return 4.5;
  }

  if (mode === "transit") {
    return 28;
  }

  return 35;
}

function estimateFallbackSegment(
  from: RoutePoint,
  to: RoutePoint,
  mode: RouteTransportMode
): RawEstimate {
  const lineDistanceKm = haversineKm(from, to);
  const adjustedDistanceKm = lineDistanceKm * 1.25;
  const speedKmh = getFallbackSpeedKmh(mode);
  const durationMin = (adjustedDistanceKm / speedKmh) * 60;

  return {
    distanceKm: roundTo(adjustedDistanceKm, 2),
    durationMin: roundTo(durationMin, 1),
    provider: "fallback"
  };
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 3500
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function estimateWithKakao(from: RoutePoint, to: RoutePoint, apiKey: string): Promise<RawEstimate> {
  const params = new URLSearchParams({
    origin: `${from.lng},${from.lat}`,
    destination: `${to.lng},${to.lat}`,
    priority: "RECOMMEND",
    alternatives: "false",
    road_details: "false"
  });
  const endpoint = `https://apis-navi.kakaomobility.com/v1/directions?${params.toString()}`;

  const payload = await fetchJsonWithTimeout(
    endpoint,
    {
      method: "GET",
      headers: {
        Authorization: `KakaoAK ${apiKey}`
      }
    },
    4000
  );

  const summary = (payload as { routes?: Array<{ summary?: { distance?: unknown; duration?: unknown } }> })
    .routes?.[0]?.summary;

  const distanceMeters = toFiniteNumber(summary?.distance);
  const durationSeconds = toFiniteNumber(summary?.duration);

  if (distanceMeters === null || durationSeconds === null) {
    throw new Error("Kakao response missing distance/duration");
  }

  return {
    distanceKm: roundTo(distanceMeters / 1000, 2),
    durationMin: roundTo(durationSeconds / 60, 1),
    provider: "kakao"
  };
}

async function estimateWithOdsay(from: RoutePoint, to: RoutePoint, apiKey: string): Promise<RawEstimate> {
  const params = new URLSearchParams({
    SX: String(from.lng),
    SY: String(from.lat),
    EX: String(to.lng),
    EY: String(to.lat),
    apiKey
  });
  const endpoint = `https://api.odsay.com/v1/api/searchPubTransPathT?${params.toString()}`;

  const payload = await fetchJsonWithTimeout(endpoint, { method: "GET" }, 4500);

  const info = (payload as {
    result?: { path?: Array<{ info?: { totalDistance?: unknown; totalTime?: unknown } }> };
  }).result?.path?.[0]?.info;

  const distanceMeters = toFiniteNumber(info?.totalDistance);
  const durationMin = toFiniteNumber(info?.totalTime);

  if (distanceMeters === null || durationMin === null) {
    throw new Error("ODSAY response missing distance/time");
  }

  return {
    distanceKm: roundTo(distanceMeters / 1000, 2),
    durationMin: roundTo(durationMin, 1),
    provider: "odsay"
  };
}

async function estimateSegment(
  from: RoutePoint,
  to: RoutePoint,
  mode: RouteTransportMode,
  keys: ProviderKeys,
  warnings: string[]
): Promise<RawEstimate> {
  const estimators: Array<{ provider: "kakao" | "odsay"; run: () => Promise<RawEstimate> }> = [];

  if (mode === "transit") {
    if (keys.odsayKey) {
      estimators.push({
        provider: "odsay",
        run: () => estimateWithOdsay(from, to, keys.odsayKey as string)
      });
    }
    if (keys.kakaoKey) {
      estimators.push({
        provider: "kakao",
        run: () => estimateWithKakao(from, to, keys.kakaoKey as string)
      });
    }
  } else {
    if (keys.kakaoKey) {
      estimators.push({
        provider: "kakao",
        run: () => estimateWithKakao(from, to, keys.kakaoKey as string)
      });
    }
    if (keys.odsayKey) {
      estimators.push({
        provider: "odsay",
        run: () => estimateWithOdsay(from, to, keys.odsayKey as string)
      });
    }
  }

  for (const estimator of estimators) {
    try {
      return await estimator.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      warnings.push(
        `${estimator.provider.toUpperCase()} estimate failed for ${from.name ?? "point"} -> ${to.name ?? "point"} (${message}).`
      );
    }
  }

  return estimateFallbackSegment(from, to, mode);
}

function deriveSource(segments: RouteSegmentEstimate[]): RouteEstimateProvider | "mixed" {
  const providers = new Set<RouteEstimateProvider>();

  for (const segment of segments) {
    providers.add(segment.provider);
  }

  if (providers.size === 1) {
    return segments[0]?.provider ?? "fallback";
  }

  return "mixed";
}

export async function optimizeRoute(input: OptimizeRouteInput): Promise<OptimizeRouteResult> {
  const warnings: string[] = [];
  const keys = resolveProviderKeys();

  if (!keys.kakaoKey && !keys.odsayKey) {
    warnings.push("No KAKAO/ODSAY API key found in process.env. Using local fallback estimates.");
  }

  const orderedWaypoints = orderWaypointsByDistance(input.start, input.waypoints);
  const orderedPoints: RoutePoint[] = [clonePoint(input.start), ...orderedWaypoints];

  if (input.end) {
    orderedPoints.push(clonePoint(input.end));
  } else if (input.roundTrip) {
    orderedPoints.push(clonePoint(input.start));
  }

  if (orderedPoints.length < 2) {
    throw new Error("Route optimization requires at least two points.");
  }

  const segments: RouteSegmentEstimate[] = [];

  for (let i = 0; i < orderedPoints.length - 1; i += 1) {
    const from = orderedPoints[i];
    const to = orderedPoints[i + 1];
    const estimate = await estimateSegment(from, to, input.mode, keys, warnings);

    segments.push({
      from,
      to,
      distanceKm: estimate.distanceKm,
      durationMin: estimate.durationMin,
      provider: estimate.provider
    });
  }

  const totalDistanceKm = roundTo(
    segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
    2
  );
  const totalDurationMin = roundTo(
    segments.reduce((sum, segment) => sum + segment.durationMin, 0),
    1
  );

  return {
    orderedPoints,
    segments,
    totalDistanceKm,
    totalDurationMin,
    source: deriveSource(segments),
    warnings
  };
}
