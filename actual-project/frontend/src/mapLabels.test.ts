import { describe, expect, it } from "vitest";
import { placeMapLabels, placeMapPhotos, type MapLabelPoint, type MapLabelRect } from "./mapLabels";

const point = (id: string, x: number, y: number, preferred = true, name = `Pantai ${id}`): MapLabelPoint =>
  ({ id, x, y, preferred, name });
const overlaps = (a: MapLabelRect, b: MapLabelRect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

function expectWithinViewport(labels: MapLabelRect[], width: number, height: number) {
  for (const label of labels) {
    expect(label.x).toBeGreaterThanOrEqual(8);
    expect(label.y).toBeGreaterThanOrEqual(8);
    expect(label.x + label.width).toBeLessThanOrEqual(width - 8);
    expect(label.y + label.height).toBeLessThanOrEqual(height - 8);
  }
  labels.forEach((label, index) => {
    for (const other of labels.slice(index + 1)) expect(overlaps(label, other)).toBe(false);
  });
}

describe("marine photo tap targets", () => {
  it("keeps coastal photos clear of nearby controls and report counts on a small phone", () => {
    const obstacles = [
      { x: 14, y: 12, width: 205, height: 32 },
      { x: 132, y: 206, width: 176, height: 44 },
      { x: 14, y: 206, width: 80, height: 44 },
      { x: 145, y: 116, width: 30, height: 30 },
    ];
    const photos = placeMapPhotos([point('turtle', 172, 214), point('coral', 160, 130)],
      { width: 320, height: 262, obstacles });
    expect(photos.map(photo => photo.id)).toEqual(['turtle', 'coral']);
    expectWithinViewport(photos, 320, 262);
    for (const photo of photos) {
      expect(photo.width).toBeGreaterThanOrEqual(44);
      for (const obstacle of obstacles) expect(overlaps(photo, obstacle)).toBe(false);
    }
    const labels = placeMapLabels([point('beach', 172, 214)],
      { width: 320, height: 262, obstacles: [...obstacles, ...photos], compact: true });
    expect(labels).toHaveLength(1);
    for (const photo of photos) expect(overlaps(labels[0], photo)).toBe(false);
  });

  it("keeps edge photos visible without bringing offscreen or invalid records into the view", () => {
    const photos = placeMapPhotos([point('edge', 318, 1), point('outside', -30, 120), point('invalid', NaN, 50)],
      { width: 320, height: 262 });
    expect(photos.map(photo => photo.id)).toEqual(['edge']);
    expectWithinViewport(photos, 320, 262);
    expect(placeMapPhotos([point('blocked', 50, 50)], { width: 100, height: 100,
      obstacles: [{ x: 0, y: 0, width: 100, height: 100 }] })).toEqual([]);
  });
});

describe("map label placement", () => {
  it("keeps all seven preferred beach names even among many nearby optional points", () => {
    const important = Array.from({ length: 7 }, (_, index) => point(`main-${index}`, 196 + index, 130 + index));
    const nearby = Array.from({ length: 20 }, (_, index) => point(`optional-${index}`, 190 + index, 135, false));
    const labels = placeMapLabels([...nearby, ...important], { width: 402, height: 320 });
    for (const { id } of important) expect(labels.some(label => label.id === id)).toBe(true);
    expectWithinViewport(labels, 402, 320);
  });

  it("uses free space for close beach names without overlapping labels or controls", () => {
    const obstacle = { x: 8, y: 8, width: 240, height: 42 };
    const labels = placeMapLabels([
      point("a", 30, 20), point("b", 31, 21), point("c", 32, 22),
      point("d", 33, 23), point("e", 300, 260),
    ], { width: 360, height: 300, obstacles: [obstacle] });
    expect(labels).toHaveLength(5);
    expectWithinViewport(labels, 360, 300);
    labels.forEach(label => expect(overlaps(label, obstacle)).toBe(false));
  });

  it("retains all five North names around the controls on a 320px phone", () => {
    const important = [
      point("kuala-perlis", 161, 116, true, "Pantai Kuala Perlis"),
      point("cenang", 116, 126, true, "Pantai Cenang"),
      point("merdeka", 186, 195, true, "Pantai Merdeka"),
      point("batu-ferringhi", 173, 216, true, "Pantai Batu Ferringhi"),
      point("bersih", 187, 218, true, "Pantai Bersih"),
    ];
    const optional = Array.from({ length: 12 }, (_, index) => point(`optional-${index}`, 140 + index, 150 + index, false));
    const obstacles = [
      { x: 14, y: 12, width: 200.82, height: 30.86 },
      { x: 234.1, y: 163.41, width: 73.89, height: 122.14 },
      { x: 14, y: 249.41, width: 78.16, height: 36.14 },
    ];
    for (const height of [307, 307.55]) {
      const labels = placeMapLabels([...optional, ...important], { width: 320, height, obstacles });
      for (const { id } of important) expect(labels.some(label => label.id === id)).toBe(true);
      expectWithinViewport(labels, 320, height);
      for (const label of labels) for (const obstacle of obstacles) expect(overlaps(label, obstacle)).toBe(false);
      expect(placeMapLabels([...important, ...optional].reverse(), { width: 320, height, obstacles })).toEqual(labels);
    }
  });

  it("preserves two columns for long preferred names at narrow widths", () => {
    const points = Array.from({ length: 6 }, (_, index) =>
      point(`long-${index}`, 160, 110 + index, true, `Pantai a longer beach name ${index}`));
    const labels = placeMapLabels(points, { width: 320, height: 170 });
    expect(labels).toHaveLength(6);
    expect(labels.every(label => label.width <= 149)).toBe(true);
    expectWithinViewport(labels, 320, 170);
  });

  it("shows all seven NSM names in compact layout below a wide region hint", () => {
    const points = [
      point("pantai-tanjung-gemuk", 130, 100, true, "Pantai Tanjung Gemuk"),
      point("pantai-cahaya-negeri", 145, 117, true, "Pantai Cahaya Negeri"),
      point("teluk-kemang", 154, 132, true, "Teluk Kemang"),
      point("pantai-pengkalan-balak", 170, 173, true, "Pantai Pengkalan Balak"),
      point("pantai-kundor", 191, 202, true, "Pantai Kundor"),
      point("pantai-siring", 213, 216, true, "Pantai Siring"),
      point("pulau-besar-melaka", 223, 236, true, "Pulau Besar, Melaka"),
      point("optional", 180, 187, false, "Pantai optional"),
    ];
    const obstacles = [
      { x: 14, y: 12, width: 219, height: 30.86 },
      { x: 234.1, y: 163.41, width: 73.89, height: 122.14 },
      { x: 14, y: 249.41, width: 78.16, height: 36.14 },
    ];
    const labels = placeMapLabels(points, { width: 320, height: 308, obstacles, compact: true });
    for (const { id } of points.filter(item => item.preferred)) expect(labels.some(label => label.id === id)).toBe(true);
    expect(labels.every(label => label.height === 34)).toBe(true);
    expectWithinViewport(labels, 320, 308);
    for (const label of labels) for (const obstacle of obstacles) expect(overlaps(label, obstacle)).toBe(false);
    expect(placeMapLabels([...points].reverse(), { width: 320, height: 308, obstacles, compact: true })).toEqual(labels);
  });

  it("does not clamp offscreen beaches onto the map after panning or zooming", () => {
    const labels = placeMapLabels([
      point("left", -9, 80), point("right", 409, 80),
      point("top", 80, -9), point("bottom", 80, 309),
      point("inside", 200, 150), point("near-edge", -7, 220),
    ], { width: 400, height: 300 });
    expect(labels.map(label => label.id)).toEqual(["inside", "near-edge"]);
    expectWithinViewport(labels, 400, 300);
  });

  it("reserves the complete height of biodiversity photo labels", () => {
    const labels = placeMapLabels([point("one", 100, 90), point("two", 103, 100), point("three", 200, 220)],
      { width: 402, height: 480, labelHeight: 94, obstacles: [{ x: 300, y: 340, width: 80, height: 125 }] });
    expect(labels).toHaveLength(3);
    expect(labels.every(label => label.height === 94)).toBe(true);
    expectWithinViewport(labels, 402, 480);
  });

  it("is deterministic across input order and orders preferred labels by y then id", () => {
    const points = [point("z", 200, 180, false), point("b", 200, 100), point("a", 201, 100), point("c", 202, 70), point("y", 203, 190, false)];
    const first = placeMapLabels(points, { width: 402, height: 400 });
    expect(placeMapLabels([...points].reverse(), { width: 402, height: 400 })).toEqual(first);
    expect(first.map(label => label.id)).toEqual(["c", "a", "b", "y", "z"]);
  });

  it("retains preferred names when only one label fits and skips unplaceable labels", () => {
    const labels = placeMapLabels([point("optional", 60, 30, false), point("main", 60, 30)], { width: 120, height: 60 });
    expect(labels.map(label => label.id)).toEqual(["main"]);
    expect(placeMapLabels([point("main", 60, 20)], { width: 120, height: 50 })).toEqual([]);
    expect(placeMapLabels([point("main", 60, 30)], { width: 120, height: 60, obstacles: [{ x: 0, y: 0, width: 120, height: 60 }] })).toEqual([]);
  });

  it("limits label dimensions and ignores invalid anchors without mutating inputs", () => {
    const points = [point("short", 15, 15, true, "A"), point("long", 390, 230, true, "Pantai a very long beach name that cannot fit at full width"), point("bad", NaN, 100)];
    const before = points.map(row => ({ ...row }));
    const labels = placeMapLabels(points, { width: 402, height: 260 });
    expect(labels.map(label => label.width)).toEqual([100, 156]);
    expect(labels.every(label => label.height === 42)).toBe(true);
    expectWithinViewport(labels, 402, 260);
    expect(points).toEqual(before);
    expect(placeMapLabels(points, { width: NaN, height: 260 })).toEqual([]);
  });
});
