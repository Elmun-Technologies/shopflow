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
