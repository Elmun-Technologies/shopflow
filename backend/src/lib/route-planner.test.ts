import { describe, expect, it } from "vitest";
import { distanceMeters, orderNearest, planConstrainedRoute, routeDistance } from "./route-planner.js";

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

  it("puts an urgent time window before a nearer unrestricted stop", () => {
    const departure = new Date("2026-09-22T08:00:00.000Z");
    const plan = planConstrainedRoute({ lat: 0, lng: 0 }, [
      { id: "near", lat: 0, lng: 0.01 },
      { id: "urgent", lat: 0, lng: 0.02, windowEndAt: new Date("2026-09-22T08:06:00.000Z") },
    ], departure, 30);
    expect(plan.stops.map((stop) => stop.id)).toEqual(["urgent", "near"]);
  });

  it("waits when arriving before the customer time window", () => {
    const departure = new Date("2026-09-22T08:00:00.000Z");
    const plan = planConstrainedRoute({ lat: 0, lng: 0 }, [
      { id: "window", lat: 0, lng: 0.001, windowStartAt: new Date("2026-09-22T09:00:00.000Z"), serviceMinutes: 5 },
    ], departure);
    expect(plan.stops[0].arrivalAt.toISOString()).toBe("2026-09-22T09:00:00.000Z");
    expect(plan.stops[0].waitingSeconds).toBeGreaterThan(3_000);
    expect(plan.totalDurationSeconds).toBeGreaterThanOrEqual(3_900);
  });

  it("prioritizes a high priority delivery", () => {
    const plan = planConstrainedRoute({ lat: 0, lng: 0 }, [
      { id: "normal", lat: 0, lng: 0.01, priority: 0 },
      { id: "vip", lat: 0, lng: 0.02, priority: 10 },
    ], new Date("2026-09-22T08:00:00.000Z"));
    expect(plan.stops[0].id).toBe("vip");
  });
});
