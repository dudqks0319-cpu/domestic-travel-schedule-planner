import type { Env } from "../bindings";
import { recordOperationalEvent } from "../db/operations";
import { dedupePlaces } from "./normalization";
import { KakaoPlaceAdapter } from "./kakao";
import { NaverPlaceAdapter } from "./naver";
import { TourPlaceAdapter } from "./tour";
import { classifyProviderError } from "./http";
import type {
  NormalizedRoute,
  PlaceProviderAdapter,
  PlaceProviderSearchInput,
  ProviderKind,
  ProviderSearchResult,
  TravelMode
} from "./types";

const PLACE_SEARCH_TTL_SECONDS = 60 * 60 * 24;
const GEOCODE_TTL_SECONDS = 60 * 60 * 24 * 7;

function cacheKey(input: PlaceProviderSearchInput): string {
  return [
    "places:v1",
    input.query.trim().toLowerCase(),
    input.category ?? "",
    input.lat?.toFixed(4) ?? "",
    input.lng?.toFixed(4) ?? "",
    input.radius ?? "",
    input.limit ?? ""
  ].join(":");
}

function adapters(env: Env): PlaceProviderAdapter[] {
  return [
    new NaverPlaceAdapter(env),
    new KakaoPlaceAdapter(env),
    new TourPlaceAdapter(env)
  ];
}

function geocodeAdapters(env: Env): PlaceProviderAdapter[] {
  return [
    new NaverPlaceAdapter(env),
    new KakaoPlaceAdapter(env)
  ];
}

function directionsAdapters(env: Env): PlaceProviderAdapter[] {
  return [
    new NaverPlaceAdapter(env),
    new KakaoPlaceAdapter(env)
  ];
}

function geocodeCacheKey(address: string): string {
  return ["geocode:v2", address.trim().toLowerCase()].join(":");
}

function reverseGeocodeCacheKey(lat: number, lng: number): string {
  return ["reverse-geocode:v2", lat.toFixed(6), lng.toFixed(6)].join(":");
}

async function searchAdapter(
  env: Env,
  adapter: PlaceProviderAdapter,
  input: PlaceProviderSearchInput
) {
  const startedAt = Date.now();
  try {
    const places = await adapter.searchPlaces(input);
    await recordOperationalEvent(env.DB, {
      eventType: "provider_adapter_search",
      target: `provider.${adapter.provider}`,
      status: places.length ? "success" : "warning",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
        placeCount: places.length,
        warningCount: places.length ? 0 : 1
      }
    });
    return {
      provider: adapter.provider,
      places
    };
  } catch (error) {
    const providerError = classifyProviderError(error);
    await recordOperationalEvent(env.DB, {
      eventType: "provider_adapter_search",
      target: `provider.${adapter.provider}`,
      status: "failure",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
        ...providerError,
        placeCount: 0,
        warningCount: 1
      }
    });
    throw error;
  }
}

async function geocodeAdapter(env: Env, adapter: PlaceProviderAdapter, address: string) {
  const startedAt = Date.now();
  try {
    const result = await adapter.geocode({ address });
    await recordOperationalEvent(env.DB, {
      eventType: "provider_geocode",
      target: `provider.${adapter.provider}`,
      status: result ? "success" : "warning",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
        warningCount: result ? 0 : 1
      }
    });
    return result;
  } catch (error) {
    const providerError = classifyProviderError(error);
    await recordOperationalEvent(env.DB, {
      eventType: "provider_geocode",
      target: `provider.${adapter.provider}`,
      status: "failure",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
        ...providerError,
        warningCount: 1
      }
    });
    throw error;
  }
}

async function reverseGeocodeAdapter(
  env: Env,
  adapter: PlaceProviderAdapter,
  input: { lat: number; lng: number }
) {
  const startedAt = Date.now();
  try {
    const result = await adapter.reverseGeocode(input);
    await recordOperationalEvent(env.DB, {
      eventType: "provider_reverse_geocode",
      target: `provider.${adapter.provider}`,
      status: result ? "success" : "warning",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
        warningCount: result ? 0 : 1
      }
    });
    return result;
  } catch (error) {
    const providerError = classifyProviderError(error);
    await recordOperationalEvent(env.DB, {
      eventType: "provider_reverse_geocode",
      target: `provider.${adapter.provider}`,
      status: "failure",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
        ...providerError,
        warningCount: 1
      }
    });
    throw error;
  }
}

async function directionsAdapter(
  env: Env,
  adapter: PlaceProviderAdapter,
  input: {
    points: Array<{ id?: string; lat: number; lng: number; name?: string }>;
    mode: TravelMode;
  }
) {
  const startedAt = Date.now();
  try {
    const route = await adapter.getDirections(input);
    await recordOperationalEvent(env.DB, {
      eventType: "provider_directions",
      target: `provider.${adapter.provider}`,
      status: route ? "success" : "warning",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
        mode: input.mode,
        pointCount: input.points.length,
        segmentCount: route?.segments.length ?? 0,
        warningCount: route ? route.warnings.length : 1
      }
    });
    return route;
  } catch (error) {
    const providerError = classifyProviderError(error);
    await recordOperationalEvent(env.DB, {
      eventType: "provider_directions",
      target: `provider.${adapter.provider}`,
      status: "failure",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
        ...providerError,
        mode: input.mode,
        pointCount: input.points.length,
        segmentCount: 0,
        warningCount: 1
      }
    });
    throw error;
  }
}

export async function searchPlaces(env: Env, input: PlaceProviderSearchInput): Promise<ProviderSearchResult> {
  const key = cacheKey(input);
  const cached = await env.PLACE_CACHE.get(key, "json");
  if (cached && typeof cached === "object" && "places" in cached) {
    return cached as ProviderSearchResult;
  }

  const warnings: string[] = [];
  const results = await Promise.allSettled(
    adapters(env).map((adapter) => searchAdapter(env, adapter, input))
  );

  const places = dedupePlaces(
    results.flatMap((result) => {
      if (result.status === "rejected") {
        warnings.push("provider search failed");
        return [];
      }
      if (result.value.places.length === 0) {
        warnings.push(`${result.value.provider} returned no places`);
      }
      return result.value.places;
    })
  ).slice(0, input.limit ?? 20);

  const payload: ProviderSearchResult = {
    places,
    warnings,
    cacheStatus: "miss"
  };

  await env.PLACE_CACHE.put(key, JSON.stringify({ ...payload, cacheStatus: "hit" }), {
    expirationTtl: PLACE_SEARCH_TTL_SECONDS
  });

  return payload;
}

type GeocodeProviderResult = {
  result: { lat: number; lng: number } | null;
  provider: ProviderKind | null;
  warnings: string[];
  cacheStatus: "hit" | "miss";
};

type ReverseGeocodeProviderResult = {
  result: { address: string } | null;
  provider: ProviderKind | null;
  warnings: string[];
  cacheStatus: "hit" | "miss";
};

export async function geocodeAddress(env: Env, address: string): Promise<GeocodeProviderResult> {
  const key = geocodeCacheKey(address);
  const cached = await env.PLACE_CACHE.get(key, "json");
  if (cached && typeof cached === "object" && "result" in cached) {
    return cached as GeocodeProviderResult;
  }

  const warnings: string[] = [];
  let result: { lat: number; lng: number } | null = null;
  let provider: ProviderKind | null = null;

  for (const adapter of geocodeAdapters(env)) {
    try {
      result = await geocodeAdapter(env, adapter, address);
      if (result) {
        provider = adapter.provider;
        break;
      }
      warnings.push(`${adapter.provider} returned no geocode result`);
    } catch {
      warnings.push(`${adapter.provider} geocode failed`);
    }
  }

  const payload = { result, provider, warnings, cacheStatus: "miss" as const };
  await env.PLACE_CACHE.put(key, JSON.stringify({ ...payload, cacheStatus: "hit" }), {
    expirationTtl: GEOCODE_TTL_SECONDS
  });

  return payload;
}

export async function reverseGeocodeCoordinate(
  env: Env,
  input: { lat: number; lng: number }
): Promise<ReverseGeocodeProviderResult> {
  const key = reverseGeocodeCacheKey(input.lat, input.lng);
  const cached = await env.PLACE_CACHE.get(key, "json");
  if (cached && typeof cached === "object" && "result" in cached) {
    return cached as ReverseGeocodeProviderResult;
  }

  const warnings: string[] = [];
  let result: { address: string } | null = null;
  let provider: ProviderKind | null = null;

  for (const adapter of geocodeAdapters(env)) {
    try {
      result = await reverseGeocodeAdapter(env, adapter, input);
      if (result) {
        provider = adapter.provider;
        break;
      }
      warnings.push(`${adapter.provider} returned no reverse geocode result`);
    } catch {
      warnings.push(`${adapter.provider} reverse geocode failed`);
    }
  }

  const payload = { result, provider, warnings, cacheStatus: "miss" as const };
  await env.PLACE_CACHE.put(key, JSON.stringify({ ...payload, cacheStatus: "hit" }), {
    expirationTtl: GEOCODE_TTL_SECONDS
  });

  return payload;
}

export async function getProviderDirections(env: Env, input: {
  points: Array<{ id?: string; lat: number; lng: number; name?: string }>;
  mode: TravelMode;
}): Promise<{
  route: NormalizedRoute | null;
  warnings: string[];
}> {
  const warnings: string[] = [];

  for (const adapter of directionsAdapters(env)) {
    try {
      const route = await directionsAdapter(env, adapter, input);
      if (route) {
        return { route, warnings };
      }
      warnings.push(`${adapter.provider} directions returned no route`);
    } catch {
      warnings.push(`${adapter.provider} directions failed`);
    }
  }

  return { route: null, warnings };
}

export type {
  NormalizedPlace,
  NormalizedRoute,
  PlaceProviderAdapter,
  PlaceProviderSearchInput,
  ProviderSearchResult,
  TravelMode
} from "./types";
