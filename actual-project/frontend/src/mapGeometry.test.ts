import { describe, expect, it } from "vitest";
import {
  BORNEO_VIEW_BOUNDS,
  getViewBounds,
  groupMapPoints,
  hasMapCoordinates,
  PENINSULA_VIEW_BOUNDS,
  REGION_VIEW_BOUNDS,
} from "./mapGeometry";

const project = (scale: number) => (lat: number, lng: number) => ({
  x: lng * scale,
  y: lat * scale,
});
const ids = (groups: ReturnType<typeof groupMapPoints>) =>
  groups.map(group => group.points.map(point => point.id));

describe("map label grouping", () => {
  it("groups nearby labels while retaining a distant beach", () => {
    const points = [
      { id: "near-a", lat: 3, lng: 101 },
      { id: "far", lat: 5, lng: 103 },
      { id: "near-b", lat: 3.1, lng: 101.1 },
    ];
    const groups = groupMapPoints(points, project(100));
    expect(ids(groups)).toEqual([["far"], ["near-a", "near-b"]]);
    expect(groups[1].lat).toBeCloseTo(3.05);
    expect(groups[1].lng).toBeCloseTo(101.05);
    expect(ids(groupMapPoints([...points].reverse(), project(100)))).toEqual(ids(groups));
  });

  it("separates the same beaches as zoom increases their screen distance", () => {
    const points = [
      { id: "a", lat: 3, lng: 101 },
      { id: "b", lat: 3.1, lng: 101.1 },
    ];
    expect(ids(groupMapPoints(points, project(100)))).toEqual([["a", "b"]]);
    expect(ids(groupMapPoints(points, project(2000)))).toEqual([["a"], ["b"]]);
  });

  it("retains every beach in a connected collision chain", () => {
    const points = [
      { id: "c", lat: 3, lng: 103 },
      { id: "a", lat: 3, lng: 101 },
      { id: "b", lat: 3, lng: 102 },
      { id: "d", lat: 5, lng: 101 },
    ];
    const groups = groupMapPoints(points, project(100));
    expect(ids(groups)).toEqual([["a", "b", "c"], ["d"]]);
    expect(groups.flatMap(group => group.points)).toHaveLength(points.length);
  });

  it("retains distinct beaches at the same location and handles no points", () => {
    const points = [
      { id: "a", lat: 3, lng: 101 },
      { id: "b", lat: 3, lng: 101 },
    ];
    expect(groupMapPoints(points, project(1000))).toEqual([{ points, lat: 3, lng: 101 }]);
    expect(groupMapPoints([], project(100))).toEqual([]);
  });
});

describe("map coordinates and regional framing", () => {
  it("rejects absent, non-finite and out-of-range coordinates", () => {
    for (const point of [
      null, undefined, {}, { lat: null, lng: 100 }, { lat: 3, lng: null },
      { lat: NaN, lng: 100 }, { lat: 3, lng: Infinity },
      { lat: 91, lng: 100 }, { lat: 3, lng: -181 },
    ]) expect(hasMapCoordinates(point)).toBe(false);
    expect(hasMapCoordinates({ lat: 0, lng: 0 })).toBe(true);
    expect(hasMapCoordinates({ lat: 6.3, lng: 99.8 })).toBe(true);
  });

  it("keeps North focused on Langkawi to Penang when its beaches lack coordinates", () => {
    const bounds = getViewBounds("north", [{ lat: null, lng: null }, { lat: NaN, lng: 100 }]);
    expect(bounds).toEqual(REGION_VIEW_BOUNDS.north);
    expect(bounds).not.toEqual(PENINSULA_VIEW_BOUNDS);
    expect(bounds[0][0]).toBeGreaterThan(5);
    expect(bounds[0][0]).toBeLessThan(5.3);
    expect(bounds[1][0]).toBeGreaterThan(6.5);
    expect(bounds[0][1]).toBeLessThan(99.7);
    expect(bounds[1][1]).toBeGreaterThan(100.4);
    expect(getViewBounds("borneo")).toEqual(BORNEO_VIEW_BOUNDS);
  });

  it("expands a region to include API points without mutating later views", () => {
    const initial = getViewBounds("north");
    const expanded = getViewBounds("north", [
      { lat: 5, lng: 99.2 }, { lat: 6.9, lng: 100.9 },
      { lat: Infinity, lng: 100 }, { lat: 1, lng: null },
    ]);
    expect(expanded).toEqual([[5, 99.2], [6.9, 100.9]]);
    expanded[0][0] = 0;
    expect(getViewBounds("north")).toEqual(initial);
    expect(getViewBounds(null)).toEqual(PENINSULA_VIEW_BOUNDS);
  });
});
