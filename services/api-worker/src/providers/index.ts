import type { Env } from "../bindings";
import { dedupePlaces } from "./normalization";
import { KakaoPlaceAdapter } from "./kakao";
import { NaverPlaceAdapter } from "./naver";
import { TourPlaceAdapter } from "./tour";
import type { PlaceProviderAdapter, PlaceProviderSearchInput, ProviderSearchResult } from "./types";

const PLACE_SEARCH_TTL_SECONDS = 60 * 60 * 24;

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

export async function searchPlaces(env: Env, input: PlaceProviderSearchInput): Promise<ProviderSearchResult> {
  const key = cacheKey(input);
  const cached = await env.PLACE_CACHE.get(key, "json");
  if (cached && typeof cached === "object" && "places" in cached) {
    return cached as ProviderSearchResult;
  }

  const warnings: string[] = [];
  const results = await Promise.allSettled(
    adapters(env).map(async (adapter) => ({
      provider: adapter.provider,
      places: await adapter.searchPlaces(input)
    }))
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

export type {
  NormalizedPlace,
  PlaceProviderAdapter,
  PlaceProviderSearchInput,
  ProviderSearchResult,
  TravelMode
} from "./types";
