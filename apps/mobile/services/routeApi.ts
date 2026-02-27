import AsyncStorage from "@react-native-async-storage/async-storage";

export type RouteTransportMode = "driving" | "transit" | "walking";
export type RouteEstimateProvider = "kakao" | "odsay" | "fallback" | "mixed";

export interface RoutePoint {
  id?: string;
  name?: string;
  lat: number;
  lng: number;
}

export interface RouteSegmentEstimate {
  from: RoutePoint;
  to: RoutePoint;
  distanceKm: number;
  durationMin: number;
  provider: "kakao" | "odsay" | "fallback";
}

export interface OptimizedRoute {
  orderedPoints: RoutePoint[];
  segments: RouteSegmentEstimate[];
  totalDistanceKm: number;
  totalDurationMin: number;
  source: RouteEstimateProvider;
  warnings: string[];
}

export interface OptimizeRouteRequest {
  start: RoutePoint;
  waypoints?: RoutePoint[];
  end?: RoutePoint;
  roundTrip?: boolean;
  mode?: RouteTransportMode;
}

interface OptimizeRouteApiResponse {
  success?: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  details?: string[];
}

class RouteApiError extends Error {
  status?: number;
  details?: string[];

  constructor(message: string, options?: { status?: number; details?: string[] }) {
    super(message);
    this.name = "RouteApiError";
    this.status = options?.status;
    this.details = options?.details;
  }
}

export const ROUTE_STORAGE_KEY = "optimizedRoute";

const DEFAULT_API_BASE_URL = "http://localhost:4000";
const ROUTE_OPTIMIZE_ENDPOINTS = ["/api/v1/route/optimize", "/api/v1/planner/route/optimize"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRoutePoint(value: unknown): value is RoutePoint {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.lat === "number" && typeof value.lng === "number";
}

function isRouteSegment(value: unknown): value is RouteSegmentEstimate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRoutePoint(value.from) &&
    isRoutePoint(value.to) &&
    typeof value.distanceKm === "number" &&
    typeof value.durationMin === "number" &&
    typeof value.provider === "string"
  );
}

function isOptimizedRoute(value: unknown): value is OptimizedRoute {
  if (!isRecord(value)) {
    return false;
  }

  const points = value.orderedPoints;
  const segments = value.segments;

  return (
    Array.isArray(points) &&
    points.every((point) => isRoutePoint(point)) &&
    Array.isArray(segments) &&
    segments.every((segment) => isRouteSegment(segment)) &&
    typeof value.totalDistanceKm === "number" &&
    typeof value.totalDurationMin === "number" &&
    typeof value.source === "string" &&
    Array.isArray(value.warnings)
  );
}

function readEnvApiBaseUrl(): string | undefined {
  const maybeProcess = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;

  const candidate = maybeProcess?.env?.EXPO_PUBLIC_API_BASE_URL;

  if (typeof candidate !== "string") {
    return undefined;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBaseUrl(raw?: string): string {
  const value = (raw ?? "").trim();
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function mapTransportMode(mode?: RouteTransportMode): RouteTransportMode {
  if (!mode) {
    return "driving";
  }

  if (mode === "walking" || mode === "transit") {
    return mode;
  }

  return "driving";
}

function toApiPayload(request: OptimizeRouteRequest): Record<string, unknown> {
  return {
    start: request.start,
    waypoints: request.waypoints ?? [],
    end: request.end,
    roundTrip: request.roundTrip ?? false,
    mode: mapTransportMode(request.mode)
  };
}

async function requestOptimizeRoute(
  endpointPath: string,
  request: OptimizeRouteRequest,
  apiBaseUrl: string,
  signal?: AbortSignal
): Promise<OptimizedRoute> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${endpointPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(toApiPayload(request)),
      signal
    });
  } catch (error) {
    const networkMessage =
      error instanceof Error ? error.message : "Network error while requesting route optimization.";
    throw new RouteApiError(networkMessage, { status: 0 });
  }

  let payload: OptimizeRouteApiResponse | null = null;

  try {
    payload = (await response.json()) as OptimizeRouteApiResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Route optimization request failed with status ${response.status}.`;
    throw new RouteApiError(message, {
      status: response.status,
      details: payload?.details
    });
  }

  const route = payload?.data;

  if (!isOptimizedRoute(route)) {
    throw new RouteApiError("Route optimization response is invalid.", {
      status: response.status
    });
  }

  return route;
}

export async function optimizeRoute(
  request: OptimizeRouteRequest,
  options?: {
    apiBaseUrl?: string;
    signal?: AbortSignal;
  }
): Promise<OptimizedRoute> {
  const baseUrl = normalizeBaseUrl(options?.apiBaseUrl ?? readEnvApiBaseUrl());
  const waypoints = request.waypoints ?? [];
  const totalPoints = 1 + waypoints.length + (request.end ? 1 : 0);

  if (!request.start || totalPoints < 2) {
    throw new RouteApiError("At least two points are required to optimize a route.");
  }

  let lastError: unknown;

  for (let i = 0; i < ROUTE_OPTIMIZE_ENDPOINTS.length; i += 1) {
    const endpoint = ROUTE_OPTIMIZE_ENDPOINTS[i];

    try {
      return await requestOptimizeRoute(endpoint, request, baseUrl, options?.signal);
    } catch (error) {
      lastError = error;
      const isFinalEndpoint = i === ROUTE_OPTIMIZE_ENDPOINTS.length - 1;

      if (isFinalEndpoint) {
        break;
      }

      if (!(error instanceof RouteApiError)) {
        continue;
      }

      const fallbackAllowed =
        error.status === 0 || error.status === 404 || error.status === 405 || error.status === 501;

      if (!fallbackAllowed) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new RouteApiError("Failed to optimize route.");
}

export async function persistOptimizedRoute(route: OptimizedRoute): Promise<void> {
  await AsyncStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(route));
}

export async function loadPersistedOptimizedRoute(): Promise<OptimizedRoute | null> {
  const raw = await AsyncStorage.getItem(ROUTE_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isOptimizedRoute(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearPersistedOptimizedRoute(): Promise<void> {
  await AsyncStorage.removeItem(ROUTE_STORAGE_KEY);
}
