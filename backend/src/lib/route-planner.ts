export type RoutePoint = { id: string; lat: number; lng: number };

/** Haversine masofasi — provider ulanmaguncha xavfsiz boshlang'ich saralash uchun. */
export function distanceMeters(a: Pick<RoutePoint, "lat" | "lng">, b: Pick<RoutePoint, "lat" | "lng">): number {
  const rad = Math.PI / 180;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Deterministik nearest-neighbour marshrut. Bu havodagi masofa bo'yicha fallback;
 * yo'l provayderi ulanganda shu kontrakt Yandex distance matrix bilan almashtiriladi.
 */
export function orderNearest(start: Pick<RoutePoint, "lat" | "lng">, points: RoutePoint[]): RoutePoint[] {
  const remaining = [...points];
  const ordered: RoutePoint[] = [];
  let current = start;
  while (remaining.length) {
    let best = 0;
    let bestDistance = distanceMeters(current, remaining[0]);
    for (let i = 1; i < remaining.length; i++) {
      const candidate = distanceMeters(current, remaining[i]);
      if (candidate < bestDistance || (candidate === bestDistance && remaining[i].id < remaining[best].id)) {
        best = i;
        bestDistance = candidate;
      }
    }
    const [next] = remaining.splice(best, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

export function routeDistance(start: Pick<RoutePoint, "lat" | "lng">, ordered: RoutePoint[]): number {
  let total = 0;
  let current = start;
  for (const point of ordered) {
    total += distanceMeters(current, point);
    current = point;
  }
  return Math.round(total);
}

export type ConstrainedRoutePoint = RoutePoint & {
  priority?: number;
  windowStartAt?: Date | null;
  windowEndAt?: Date | null;
  serviceMinutes?: number;
};
export type PlannedRoutePoint = ConstrainedRoutePoint & {
  arrivalAt: Date;
  departureAt: Date;
  distanceFromPreviousMeters: number;
  waitingSeconds: number;
  lateSeconds: number;
};

/**
 * Provider-independent constrained fallback planner. Masofadan tashqari mijozning
 * vaqt oynasi va delivery prioritetini hisobga oladi. Road matrix kelgach faqat
 * segment travel time manbasi almashtiriladi, kontrakt o'zgarmaydi.
 */
export function planConstrainedRoute(
  start: Pick<RoutePoint, "lat" | "lng">,
  points: ConstrainedRoutePoint[],
  departureAt: Date,
  averageSpeedKmh = 25,
): { stops: PlannedRoutePoint[]; totalDistanceMeters: number; totalDurationSeconds: number; lateStops: number } {
  const remaining = [...points];
  const stops: PlannedRoutePoint[] = [];
  const metersPerSecond = Math.max(5, averageSpeedKmh) * 1_000 / 3_600;
  let cursor = start;
  let clock = departureAt.getTime();
  let totalDistance = 0;

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index++) {
      const point = remaining[index];
      const travelSeconds = distanceMeters(cursor, point) / metersPerSecond;
      const rawArrival = clock + travelSeconds * 1_000;
      const lateSeconds = point.windowEndAt ? Math.max(0, (rawArrival - point.windowEndAt.getTime()) / 1_000) : 0;
      const deadlineUrgency = point.windowEndAt ? Math.max(0, (point.windowEndAt.getTime() - clock) / 1_000) / 20 : 100_000;
      const score = travelSeconds + lateSeconds * 20 + deadlineUrgency - Math.max(0, point.priority ?? 0) * 600;
      if (score < bestScore || (score === bestScore && point.id < remaining[bestIndex].id)) { bestIndex = index; bestScore = score; }
    }
    const [point] = remaining.splice(bestIndex, 1);
    const segmentDistance = distanceMeters(cursor, point);
    const rawArrival = clock + segmentDistance / metersPerSecond * 1_000;
    const arrivalMs = point.windowStartAt ? Math.max(rawArrival, point.windowStartAt.getTime()) : rawArrival;
    const waitingSeconds = Math.max(0, Math.round((arrivalMs - rawArrival) / 1_000));
    const lateSeconds = point.windowEndAt ? Math.max(0, Math.round((arrivalMs - point.windowEndAt.getTime()) / 1_000)) : 0;
    const departureMs = arrivalMs + (point.serviceMinutes ?? 10) * 60_000;
    stops.push({ ...point, arrivalAt: new Date(arrivalMs), departureAt: new Date(departureMs), distanceFromPreviousMeters: Math.round(segmentDistance), waitingSeconds, lateSeconds });
    totalDistance += segmentDistance; clock = departureMs; cursor = point;
  }
  return { stops, totalDistanceMeters: Math.round(totalDistance), totalDurationSeconds: Math.max(0, Math.round((clock - departureAt.getTime()) / 1_000)), lateStops: stops.filter((stop) => stop.lateSeconds > 0).length };
}
