import type { BeachSummary } from './types';

type Point = { lat: number; lng: number };
type LocatedBeach = Pick<BeachSummary, 'id' | 'lat' | 'lng'>;

function valid(point: { lat: number | null; lng: number | null }): point is Point {
  return typeof point.lat === 'number' && Number.isFinite(point.lat)
    && Math.abs(point.lat) <= 90 && typeof point.lng === 'number'
    && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
}

/** Approximate great-circle distance, sufficient for picking among known beach points. */
export function beachDistanceKm(from: Point, to: Point): number {
  const radians = Math.PI / 180;
  const a = Math.sin((to.lat - from.lat) * radians / 2) ** 2 +
    Math.cos(from.lat * radians) * Math.cos(to.lat * radians) *
    Math.sin((to.lng - from.lng) * radians / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

/** Pure local ranking: device coordinates are never sent to the API or stored. */
export function closestSupportedBeach<T extends LocatedBeach>(beaches: T[], location: Point): T | null {
  if (!valid(location)) return null;
  let best: (T & Point) | null = null;
  for (const beach of beaches) {
    if (!valid(beach)) continue;
    if (!best || beachDistanceKm(location, beach) < beachDistanceKm(location, best)) {
      best = beach;
    }
  }
  return best;
}
