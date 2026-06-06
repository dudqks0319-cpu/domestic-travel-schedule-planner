import type { Env } from "../bindings";
import { recordOperationalEvent } from "../db/operations";
import { dedupePlaces } from "./normalization";
import { KakaoPlaceAdapter } from "./kakao";
import { NaverPlaceAdapter } from "./naver";
import { TourPlaceAdapter } from "./tour";
import type { PlaceProviderAdapter, PlaceProviderSearchInput, ProviderSearchResult } from "./types";

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
    new KakaoPlaceAdapter(env)
  ];
}

function geocodeCacheKey(address: string): string {
  return ["geocode:v1", address.trim().toLowerCase()].join(":");
}

function reverseGeocodeCacheKey(lat: number, lng: number): string {
  return ["reverse-geocode:v1", lat.toFixed(6), lng.toFixed(6)].join(":");
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
    await recordOperationalEvent(env.DB, {
      eventType: "provider_adapter_search",
      target: `provider.${adapter.provider}`,
      status: "failure",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
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
    await recordOperationalEvent(env.DB, {
      eventType: "provider_geocode",
      target: `provider.${adapter.provider}`,
      status: "failure",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
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
    await recordOperationalEvent(env.DB, {
      eventType: "provider_reverse_geocode",
      target: `provider.${adapter.provider}`,
      status: "failure",
      durationMs: Date.now() - startedAt,
      metadata: {
        provider: adapter.provider,
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

export async function geocodeAddress(env: Env, address: string): Promise<{
  result: { lat: number; lng: number } | null;
  warnings: string[];
  cacheStatus: "hit" | "miss";
}> {
  const key = geocodeCacheKey(address);
  const cached = await env.PLACE_CACHE.get(key, "json");
  if (cached && typeof cached === "object" && "result" in cached) {
    return cached as { result: { lat: number; lng: number } | null; warnings: string[]; cacheStatus: "hit" };
  }

  const warnings: string[] = [];
  let result: { lat: number; lng: number } | null = null;

  for (const adapter of geocodeAdapters(env)) {
    try {
      result = await geocodeAdapter(env, adapter, address);
      if (result) {
        break;
      }
      warnings.push(`${adapter.provider} returned no geocode result`);
    } catch {
      warnings.push(`${adapter.provider} geocode failed`);
    }
  }

  const payload = { result, warnings, cacheStatus: "miss" as const };
  await env.PLACE_CACHE.put(key, JSON.stringify({ ...payload, cacheStatus: "hit" }), {
    expirationTtl: GEOCODE_TTL_SECONDS
  });

  return payload;
}

export async function reverseGeocodeCoordinate(env: Env, input: { lat: number; lng: number }): Promise<{
  result: { address: string } | null;
  warnings: string[];
  cacheStatus: "hit" | "miss";
}> {
  const key = reverseGeocodeCacheKey(input.lat, input.lng);
  const cached = await env.PLACE_CACHE.get(key, "json");
  if (cached && typeof cached === "object" && "result" in cached) {
    return cached as { result: { address: string } | null; warnings: string[]; cacheStatus: "hit" };
  }

  const warnings: string[] = [];
  let result: { address: string } | null = null;

  for (const adapter of geocodeAdapters(env)) {
    try {
      result = await reverseGeocodeAdapter(env, adapter, input);
      if (result) {
        break;
      }
      warnings.push(`${adapter.provider} returned no reverse geocode result`);
    } catch {
      warnings.push(`${adapter.provider} reverse geocode failed`);
    }
  }

  const payload = { result, warnings, cacheStatus: "miss" as const };
  await env.PLACE_CACHE.put(key, JSON.stringify({ ...payload, cacheStatus: "hit" }), {
    expirationTtl: GEOCODE_TTL_SECONDS
  });

  return payload;
}

export type {
  NormalizedPlace,
  PlaceProviderAdapter,
  PlaceProviderSearchInput,
  ProviderSearchResult,
  TravelMode
} from "./types";
