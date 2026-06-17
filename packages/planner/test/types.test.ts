import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRAVEL_STYLE_KEY,
  TRAVEL_STYLE_KEYS,
  isTravelStyleKey,
  normalizeTravelStyleKey
} from "../src";

describe("TripMate v1 travel style contract", () => {
  it("keeps the required v1 quick-start style keys stable", () => {
    expect(TRAVEL_STYLE_KEYS).toEqual([
      "sea_cafe_food",
      "food_focused",
      "history_walk",
      "with_kids",
      "rainy_day",
      "walking_trip",
      "drive_trip",
      "with_parents",
      "pet_friendly"
    ]);
  });

  it("normalizes unknown style values to the default", () => {
    expect(isTravelStyleKey("drive_trip")).toBe(true);
    expect(isTravelStyleKey("맛집 집중")).toBe(false);
    expect(normalizeTravelStyleKey("맛집 집중")).toBe(DEFAULT_TRAVEL_STYLE_KEY);
    expect(normalizeTravelStyleKey("rainy_day")).toBe("rainy_day");
  });
});
