import { describe, expect, it } from "vitest";
import { distanceMeters, orderNearest, routeDistance } from "./route-planner.js";

describe("route planner fallback", () => {
  it("calculates realistic distance", () => {
    const meters = distanceMeters({ lat: 41.3111, lng: 69.2797 }, { lat: 41.2995, lng: 69.2401 });
    expect(meters).toBeGreaterThan(3_000);
    expect(meters).toBeLessThan(4_000);
  });

  it("orders stops from nearest to farthest from each previous stop", () => {
    const ordered = orderNearest({ lat: 0, lng: 0 }, [
      { id: "far", lat: 0, lng: 3 },
      { id: "near", lat: 0, lng: 1 },
      { id: "middle", lat: 0, lng: 2 },
    ]);
    expect(ordered.map((p) => p.id)).toEqual(["near", "middle", "far"]);
    expect(routeDistance({ lat: 0, lng: 0 }, ordered)).toBeGreaterThan(300_000);
  });

  it("does not mutate input", () => {
    const points = [{ id: "a", lat: 1, lng: 1 }];
    orderNearest({ lat: 0, lng: 0 }, points);
    expect(points).toHaveLength(1);
  });
});
