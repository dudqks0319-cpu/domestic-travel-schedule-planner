import { describe, expect, it } from "vitest";

import { generateTripPlan, getTripDayCount, type NormalizedPlace, type TravelStyleKey } from "../src";

const place = (
  id: string,
  name: string,
  category: string,
  lat: number,
  lng: number,
  tags: string[] = [],
  score = 70
): NormalizedPlace => ({
  id,
  provider: "manual",
  name,
  category,
  lat,
  lng,
  tags,
  score,
  isSponsored: false
});

const seoulPlaces = [
  place("palace", "경복궁", "관광지", 37.5796, 126.977, ["history"]),
  place("museum", "국립현대미술관", "박물관/전시", 37.5788, 126.9804, ["indoor", "museum"]),
  place("lunch", "서촌 한식당", "맛집", 37.5803, 126.9711, ["restaurant"]),
  place("cafe", "북촌 카페", "카페", 37.5826, 126.983, ["cafe"]),
  place("market", "광장시장", "시장 맛집", 37.5701, 126.9996, ["restaurant", "market"])
];

function generate(styleKey: TravelStyleKey, places: NormalizedPlace[], startDate = "2026-06-10", endDate = "2026-06-11") {
  return generateTripPlan({
    destination: "서울",
    startDate,
    endDate,
    styleKey,
    mode: styleKey === "walker_transit" ? "transit" : "driving",
    places
  });
}

describe("TripMate v1 trip planner", () => {
  it("calculates bounded inclusive trip day counts", () => {
    expect(getTripDayCount("2026-06-10", "2026-06-10")).toBe(1);
    expect(getTripDayCount("2026-06-10", "2026-06-11")).toBe(2);
    expect(getTripDayCount("2026-06-10", "2026-06-12")).toBe(3);
    expect(getTripDayCount("bad", "2026-06-12")).toBe(1);
  });

  it("generates a one-day schedule with timed places and a route summary", () => {
    const result = generate("sea_cafe_food", seoulPlaces, "2026-06-10", "2026-06-10");

    expect(result.days).toHaveLength(1);
    expect(result.days[0]?.places.length).toBeGreaterThanOrEqual(3);
    expect(result.days[0]?.places[0]?.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(result.routeSummary.totalDistanceKm).toBeGreaterThan(0);
  });

  it("creates multi-day schedules for two, three, and five day trips", () => {
    const manyPlaces = [
      ...seoulPlaces,
      place("park", "서울숲", "자연 공원", 37.5444, 127.0374, ["nature"]),
      place("kids", "어린이박물관", "아이와 함께 실내", 37.5238, 126.9805, ["kids", "indoor"]),
      place("dinner", "을지로 저녁식당", "맛집", 37.5662, 126.9917, ["restaurant"])
    ];

    expect(generate("sea_cafe_food", manyPlaces, "2026-06-10", "2026-06-11").days).toHaveLength(2);
    expect(generate("sea_cafe_food", manyPlaces, "2026-06-10", "2026-06-12").days).toHaveLength(3);
    expect(generate("sea_cafe_food", manyPlaces, "2026-06-10", "2026-06-14").days).toHaveLength(5);
  });

  it("changes place emphasis by style", () => {
    const places = [
      place("food-a", "로컬 국밥", "맛집", 37.566, 126.98, ["restaurant"], 70),
      place("food-b", "시장 분식", "시장 맛집", 37.567, 126.981, ["restaurant", "market"], 68),
      place("museum-a", "역사박물관", "박물관", 37.568, 126.982, ["museum", "indoor"], 66),
      place("palace-a", "고궁 산책", "역사 관광지", 37.569, 126.983, ["history"], 65)
    ];

    const foodPlan = generate("food_focused", places, "2026-06-10", "2026-06-10");
    const rainyPlan = generate("rainy_backup", places, "2026-06-10", "2026-06-10");

    expect(foodPlan.days[0]?.places[0]?.category).toMatch(/맛집|시장/);
    expect(rainyPlan.days[0]?.places[0]?.title).toContain("역사박물관");
  });

  it("avoids placing distant regions on the same day when trip length allows", () => {
    const distantPlaces = [
      place("seoul-a", "서울 전시", "박물관", 37.5665, 126.978, ["museum"]),
      place("seoul-b", "서울 맛집", "맛집", 37.57, 126.98, ["restaurant"]),
      place("busan-a", "부산 해변", "자연", 35.1796, 129.0756, ["nature"]),
      place("busan-b", "부산 시장", "맛집", 35.1006, 129.0305, ["restaurant"])
    ];

    const result = generate("walker_transit", distantPlaces, "2026-06-10", "2026-06-11");
    const dayTitles = result.days.map((day) => day.places.map((tripPlace) => tripPlace.title));

    expect(dayTitles[0]?.some((title) => title.includes("서울"))).toBe(true);
    expect(dayTitles[0]?.some((title) => title.includes("부산"))).toBe(false);
    expect(dayTitles[1]?.some((title) => title.includes("부산"))).toBe(true);
  });

  it("returns an empty recoverable plan when provider places are unavailable", () => {
    const result = generate("sea_cafe_food", []);

    expect(result.days).toHaveLength(2);
    expect(result.days.every((day) => day.places.length === 0)).toBe(true);
    expect(result.providerWarnings[0]?.code).toBe("NO_PROVIDER_PLACES");
    expect(result.regenerationHints[0]?.code).toBe("RETRY_PROVIDER_SEARCH");
  });
});
