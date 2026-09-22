import { describe, expect, it } from "vitest";
import { allocateDeliveries } from "./dispatch-planner.js";

const resources = [
  { driverId: "west", vehicleId: "v1", start: { lat: 0, lng: 0 }, capacityKg: 10, capacityM3: 2 },
  { driverId: "east", vehicleId: "v2", start: { lat: 0, lng: 10 }, capacityKg: 20, capacityM3: 3 },
];

describe("automatic dispatch planner", () => {
  it("assigns deliveries to the closest available courier", () => {
    const result = allocateDeliveries([
      { id: "a", lat: 0, lng: 1, weightKg: 1 },
      { id: "b", lat: 0, lng: 9, weightKg: 1 },
    ], resources);
    expect(result.plans.find((plan) => plan.driverId === "west")?.deliveryIds).toContain("a");
    expect(result.plans.find((plan) => plan.driverId === "east")?.deliveryIds).toContain("b");
  });

  it("never exceeds weight or volume capacity", () => {
    const result = allocateDeliveries([
      { id: "heavy", lat: 0, lng: 1, weightKg: 15, volumeM3: 2.5 },
      { id: "small", lat: 0, lng: 2, weightKg: 8, volumeM3: 1 },
    ], resources);
    expect(result.plans.find((plan) => plan.driverId === "east")?.deliveryIds).toContain("heavy");
    expect(result.plans.find((plan) => plan.driverId === "west")?.deliveryIds).toContain("small");
  });

  it("reports deliveries that fit no vehicle", () => {
    const result = allocateDeliveries([{ id: "oversized", lat: 0, lng: 1, weightKg: 100 }], resources);
    expect(result.plans).toHaveLength(0);
    expect(result.unassigned).toEqual([{ id: "oversized", reason: "CAPACITY" }]);
  });

  it("does not mutate input and is deterministic", () => {
    const deliveries = [{ id: "a", lat: 0, lng: 5, priority: 10 }, { id: "b", lat: 0, lng: 5 }];
    const first = allocateDeliveries(deliveries, resources);
    const second = allocateDeliveries(deliveries, resources);
    expect(first).toEqual(second);
    expect(deliveries[0].id).toBe("a");
  });
});
