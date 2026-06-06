import { describe, expect, it } from "vitest";

import { haversineDistanceKm, isValidCoordinate, optimizeOrder } from "../src";

describe("planner geo primitives", () => {
  it("validates Korean coordinates and rejects impossible values", () => {
    expect(isValidCoordinate({ lat: 37.5665, lng: 126.978 })).toBe(true);
    expect(isValidCoordinate({ lat: 120, lng: 126.978 })).toBe(false);
    expect(isValidCoordinate({ lat: 37.5665, lng: 220 })).toBe(false);
  });

  it("calculates a non-zero Seoul to Busan distance", () => {
    const distanceKm = haversineDistanceKm(
      { lat: 37.5665, lng: 126.978 },
      { lat: 35.1796, lng: 129.0756 }
    );

    expect(distanceKm).toBeGreaterThan(300);
    expect(distanceKm).toBeLessThan(400);
  });

  it("keeps the requested start point first when optimizing order", () => {
    const result = optimizeOrder(
      [
        { id: "gangneung", lat: 37.7519, lng: 128.8761 },
        { id: "busan", lat: 35.1796, lng: 129.0756 }
      ],
      { id: "seoul", lat: 37.5665, lng: 126.978 }
    );

    expect(result.orderedIds[0]).toBe("seoul");
    expect(result.orderedIds).toEqual(expect.arrayContaining(["gangneung", "busan"]));
    expect(result.totalDistanceKm).toBeGreaterThan(0);
  });
});
