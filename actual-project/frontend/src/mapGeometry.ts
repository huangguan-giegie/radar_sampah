export type MapViewBounds = [[number, number], [number, number]];

// Broad navigation extents, not beach locations or administrative boundaries.
export const PENINSULA_VIEW_BOUNDS: MapViewBounds = [
  [1.1, 99.4], [6.8, 104.6],
];
export const BORNEO_VIEW_BOUNDS: MapViewBounds = [
  [0.7, 109.3], [7.5, 119.8],
];
export const REGION_VIEW_BOUNDS: Record<string, MapViewBounds> = {
  north: [[5.1, 99.5], [6.75, 100.75]],
  perak: [[3.7, 100.1], [5.3, 101.35]],
  selangor: [[2.55, 100.65], [3.9, 101.8]],
  nsm: [[1.95, 101.65], [2.85, 102.75]],
  johor: [[1.1, 102.4], [2.9, 104.8]],
  pahang: [[2.55, 102.85], [4.85, 104.45]],
  tganu: [[3.75, 102.35], [6.05, 103.65]],
  kelantan: [[5.65, 101.9], [6.35, 102.85]],
  borneo: BORNEO_VIEW_BOUNDS,
};

type OptionalCoordinates = { lat?: number | null; lng?: number | null };

export function hasMapCoordinates<T extends OptionalCoordinates>(
  point: T | null | undefined,
): point is T & { lat: number; lng: number } {
  return !!point &&
    typeof point.lat === "number" && Number.isFinite(point.lat) &&
    typeof point.lng === "number" && Number.isFinite(point.lng) &&
    point.lat >= -90 && point.lat <= 90 &&
    point.lng >= -180 && point.lng <= 180;
}

/** Pass the selected region's API points; missing points retain its broad view. */
export function getViewBounds(
  regionId: string | null | undefined,
  points: readonly OptionalCoordinates[] = [],
): MapViewBounds {
  const base = regionId && Object.prototype.hasOwnProperty.call(REGION_VIEW_BOUNDS, regionId)
    ? REGION_VIEW_BOUNDS[regionId]
    : PENINSULA_VIEW_BOUNDS;
  const bounds: MapViewBounds = [[...base[0]], [...base[1]]];
  for (const point of points) {
    if (!hasMapCoordinates(point)) continue;
    bounds[0][0] = Math.min(bounds[0][0], point.lat);
    bounds[0][1] = Math.min(bounds[0][1], point.lng);
    bounds[1][0] = Math.max(bounds[1][0], point.lat);
    bounds[1][1] = Math.max(bounds[1][1], point.lng);
  }
  return bounds;
}

export type MapPoint = { id: string; lat: number; lng: number };
export type MapPointGroup<T extends MapPoint> = {
  points: T[];
  lat: number;
  lng: number;
};

/** Group overlapping 144 x 58 labels in the current map projection. */
export function groupMapPoints<T extends MapPoint>(
  points: readonly T[],
  project: (lat: number, lng: number) => { x: number; y: number },
  footprint = { width: 144, height: 58 },
): MapPointGroup<T>[] {
  const rows = points.filter(hasMapCoordinates).slice().sort((a, b) =>
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || a.lat - b.lat || a.lng - b.lng,
  );
  const projected = rows.map(point => project(point.lat, point.lng));
  const parents = rows.map((_, index) => index);
  const root = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };

  for (let a = 0; a < rows.length; a += 1) {
    for (let b = a + 1; b < rows.length; b += 1) {
      if (
        Math.abs(projected[a].x - projected[b].x) < footprint.width &&
        Math.abs(projected[a].y - projected[b].y) < footprint.height
      ) {
        parents[root(b)] = root(a);
      }
    }
  }

  const groups = new Map<number, T[]>();
  rows.forEach((point, index) => {
    const key = root(index);
    const members = groups.get(key);
    if (members) members.push(point);
    else groups.set(key, [point]);
  });
  return [...groups.values()].map(members => ({
    points: members,
    lat: members.reduce((sum, point) => sum + point.lat, 0) / members.length,
    lng: members.reduce((sum, point) => sum + point.lng, 0) / members.length,
  }));
}
