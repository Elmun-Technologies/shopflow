import { distanceMeters, type RoutePoint } from "./route-planner.js";

export type DispatchDelivery = RoutePoint & {
  weightKg?: number | null;
  volumeM3?: number | null;
  priority?: number;
  windowEndAt?: Date | null;
};
export type DispatchResource = {
  driverId: string;
  vehicleId?: string | null;
  start: Pick<RoutePoint, "lat" | "lng">;
  capacityKg?: number | null;
  capacityM3?: number | null;
};
export type DispatchPlan = DispatchResource & {
  deliveryIds: string[];
  totalWeightKg: number;
  totalVolumeM3: number;
  estimatedDistanceMeters: number;
};

/**
 * Deterministik multi-courier fallback allocator. Urgent deliveries are placed
 * first, then each one is assigned to the closest resource that still has
 * weight/volume capacity. Road-matrix integration can replace only distance.
 */
export function allocateDeliveries(deliveries: DispatchDelivery[], resources: DispatchResource[]): { plans: DispatchPlan[]; unassigned: Array<{ id: string; reason: string }> } {
  const plans: DispatchPlan[] = resources.map((resource) => ({ ...resource, deliveryIds: [], totalWeightKg: 0, totalVolumeM3: 0, estimatedDistanceMeters: 0 }));
  const lastPoint = new Map(resources.map((resource) => [resource.driverId, resource.start]));
  const sorted = [...deliveries].sort((a, b) => {
    const priority = (b.priority ?? 0) - (a.priority ?? 0); if (priority) return priority;
    const aEnd = a.windowEndAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bEnd = b.windowEndAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return aEnd - bEnd || a.id.localeCompare(b.id);
  });
  const unassigned: Array<{ id: string; reason: string }> = [];

  for (const delivery of sorted) {
    const weight = Math.max(0, delivery.weightKg ?? 0);
    const volume = Math.max(0, delivery.volumeM3 ?? 0);
    const candidates = plans.filter((plan) =>
      (plan.capacityKg == null || plan.totalWeightKg + weight <= plan.capacityKg) &&
      (plan.capacityM3 == null || plan.totalVolumeM3 + volume <= plan.capacityM3));
    if (!candidates.length) { unassigned.push({ id: delivery.id, reason: "CAPACITY" }); continue; }
    candidates.sort((a, b) => {
      const distanceA = distanceMeters(lastPoint.get(a.driverId)!, delivery);
      const distanceB = distanceMeters(lastPoint.get(b.driverId)!, delivery);
      // Small load-balancing penalty avoids filling one courier unnecessarily.
      return (distanceA + a.deliveryIds.length * 2_000) - (distanceB + b.deliveryIds.length * 2_000) || a.driverId.localeCompare(b.driverId);
    });
    const chosen = candidates[0];
    chosen.estimatedDistanceMeters += Math.round(distanceMeters(lastPoint.get(chosen.driverId)!, delivery));
    chosen.deliveryIds.push(delivery.id); chosen.totalWeightKg += weight; chosen.totalVolumeM3 += volume;
    lastPoint.set(chosen.driverId, delivery);
  }
  return { plans: plans.filter((plan) => plan.deliveryIds.length > 0), unassigned };
}
