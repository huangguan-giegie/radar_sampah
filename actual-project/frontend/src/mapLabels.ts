export type MapLabelPoint = {
  id: string;
  x: number;
  y: number;
  preferred: boolean;
  name: string;
};

export type MapLabelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlacedMapLabel = MapLabelRect & { id: string };

export type MapLabelLayoutOptions = {
  width: number;
  height: number;
  obstacles?: readonly MapLabelRect[];
  compact?: boolean;
  labelHeight?: number;
};

const MARGIN = 8;
const GAP = 6;
const ANCHOR_GAP = 10;
const GRID_STEP = 12;
const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const labelWidth = (name: string, maximum = 156) => Math.min(maximum, Math.max(100, Math.ceil(name.length * 6.2 + 22)));

function overlaps(a: MapLabelRect, b: MapLabelRect): boolean {
  return a.x < b.x + b.width + GAP && a.x + a.width + GAP > b.x &&
    a.y < b.y + b.height + GAP && a.y + a.height + GAP > b.y;
}

function leaderDistance(point: MapLabelPoint, rect: MapLabelRect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width);
  const dy = Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height);
  return dx * dx + dy * dy;
}

/** Layout labels separately from the beach dots, preserving each visible named beach. */
export function placeMapLabels(
  points: readonly MapLabelPoint[],
  { width, height, obstacles = [], compact = false, labelHeight = compact ? 34 : 42 }: MapLabelLayoutOptions,
): PlacedMapLabel[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 100 + MARGIN * 2 || height < labelHeight + MARGIN * 2) return [];
  // Keep two possible label columns on small phones; normal map widths retain 156px.
  const maximumWidth = Math.max(100, Math.min(156, Math.floor((width - MARGIN * 2 - GAP) / 2)));
  const widthFor = (point: MapLabelPoint) => labelWidth(point.name, maximumWidth);

  const blocked = obstacles.filter(rect =>
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0,
  );
  const visible = points.filter(point =>
    Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= -MARGIN && point.x <= width + MARGIN &&
    point.y >= -MARGIN && point.y <= height + MARGIN,
  ).slice().sort((a, b) => Number(b.preferred) - Number(a.preferred) ||
    (a.preferred ? a.y - b.y : 0) || compareId(a.id, b.id) || a.x - b.x || compareId(a.name, b.name));
  const seen = new Set<string>();
  const unique = visible.filter(point => {
    if (seen.has(point.id)) return false;
    seen.add(point.id);
    return true;
  });
  const preferred = unique.filter(point => point.preferred);
  const others = unique.filter(point => !point.preferred);
  const fits = (rect: MapLabelRect, placed: readonly PlacedMapLabel[]) =>
    rect.x >= MARGIN && rect.y >= MARGIN &&
    rect.x + rect.width <= width - MARGIN && rect.y + rect.height <= height - MARGIN &&
    !blocked.some(other => overlaps(rect, other)) && !placed.some(other => overlaps(rect, other));

  function placeOne(point: MapLabelPoint, placed: readonly PlacedMapLabel[]): PlacedMapLabel | undefined {
    const w = widthFor(point);
    const maxX = width - MARGIN - w;
    const maxY = height - MARGIN - labelHeight;
    if (maxX < MARGIN) return undefined;
    const candidates: MapLabelRect[] = [];
    const keys = new Set<string>();
    const add = (x: number, y: number) => {
      const rect = { x: Math.max(MARGIN, Math.min(maxX, x)), y: Math.max(MARGIN, Math.min(maxY, y)), width: w, height: labelHeight };
      const key = `${rect.x},${rect.y}`;
      if (!keys.has(key)) {
        keys.add(key);
        candidates.push(rect);
      }
    };
    // First try the four short leader positions and then their diagonals.
    add(point.x - w / 2, point.y - labelHeight - ANCHOR_GAP);
    add(point.x - w / 2, point.y + ANCHOR_GAP);
    add(point.x - w - ANCHOR_GAP, point.y - labelHeight / 2);
    add(point.x + ANCHOR_GAP, point.y - labelHeight / 2);
    for (const x of [point.x - w - ANCHOR_GAP, point.x + ANCHOR_GAP]) {
      add(x, point.y - labelHeight - ANCHOR_GAP);
      add(x, point.y + ANCHOR_GAP);
    }
    const nearby = candidates.find(rect => fits(rect, placed));
    if (nearby) return { id: point.id, ...nearby };

    // Edge columns, a regular grid, and obstacle edges leave room for close coastlines.
    const xs = new Set([MARGIN, maxX, point.x - w / 2]);
    const ys = new Set([MARGIN, maxY, point.y - labelHeight / 2]);
    for (let x = MARGIN; x <= maxX; x += GRID_STEP) xs.add(x);
    for (let y = MARGIN; y <= maxY; y += GRID_STEP) ys.add(y);
    for (const rect of [...blocked, ...placed]) {
      xs.add(rect.x - w - GAP);
      xs.add(rect.x + rect.width + GAP);
      ys.add(rect.y - labelHeight - GAP);
      ys.add(rect.y + rect.height + GAP);
    }
    for (const x of xs) for (const y of ys) add(x, y);
    const fallback = candidates.filter(rect => fits(rect, placed)).sort((a, b) =>
      leaderDistance(point, a) - leaderDistance(point, b) || a.y - b.y || a.x - b.x,
    )[0];
    return fallback ? { id: point.id, ...fallback } : undefined;
  }

  let placed: PlacedMapLabel[] = [];
  for (const point of preferred) {
    const label = placeOne(point, placed);
    if (label) placed.push(label);
  }

  // If greedy close placement fragmented the available space, repack preferred
  // labels into reserved rows before allowing optional names to take any space.
  if (placed.length < preferred.length && preferred.length > 0) {
    const cellWidth = Math.max(...preferred.map(widthFor));
    // A fractional-height header must not waste an entire row of free space.
    const rowOrigins = [...new Set([MARGIN, ...blocked.map(rect => rect.y + rect.height + GAP)])]
      .filter(y => y >= MARGIN && y + labelHeight <= height - MARGIN).sort((a, b) => a - b);
    for (const rowOrigin of rowOrigins) {
      const slots: MapLabelRect[] = [];
      for (let y = rowOrigin; y + labelHeight <= height - MARGIN; y += labelHeight + GAP) {
        for (let x = MARGIN; x + cellWidth <= width - MARGIN; x += cellWidth + GAP) {
          const slot = { x, y, width: cellWidth, height: labelHeight };
          if (!blocked.some(rect => overlaps(slot, rect))) slots.push(slot);
        }
      }
      const repacked: PlacedMapLabel[] = [];
      for (const point of preferred) {
        const w = widthFor(point);
        const choices = slots.map((slot, index) => ({
          index,
          rect: { ...slot, x: slot.x + (cellWidth - w) / 2, width: w },
        })).sort((a, b) => leaderDistance(point, a.rect) - leaderDistance(point, b.rect) || a.index - b.index);
        if (!choices.length) break;
        const best = choices[0];
        repacked.push({ id: point.id, ...best.rect });
        slots.splice(best.index, 1);
      }
      if (repacked.length > placed.length) placed = repacked;
      if (placed.length === preferred.length) break;
    }
  }

  for (const point of others) {
    const label = placeOne(point, placed);
    if (label) placed.push(label);
  }

  // Reuse the occupied slots but shorten crossed leaders after greedy packing.
  // Swapping never removes a name or displaces optional labels or map controls.
  const preferredById = new Map(preferred.map(point => [point.id, point]));
  for (let pass = 0; pass < preferred.length * 2; pass += 1) {
    let improved = false;
    for (let i = 0; i < placed.length; i += 1) {
      const firstPoint = preferredById.get(placed[i].id);
      if (!firstPoint) continue;
      for (let j = i + 1; j < placed.length; j += 1) {
        const secondPoint = preferredById.get(placed[j].id);
        if (!secondPoint) continue;
        const first = placed[i];
        const second = placed[j];
        const swappedFirst = { ...first, x: second.x + (second.width - first.width) / 2, y: second.y };
        const swappedSecond = { ...second, x: first.x + (first.width - second.width) / 2, y: first.y };
        const previousDistance = leaderDistance(firstPoint, first) + leaderDistance(secondPoint, second);
        const nextDistance = leaderDistance(firstPoint, swappedFirst) + leaderDistance(secondPoint, swappedSecond);
        if (nextDistance + 1 >= previousDistance || overlaps(swappedFirst, swappedSecond)) continue;
        const otherLabels = placed.filter((_, index) => index !== i && index !== j);
        if (!fits(swappedFirst, otherLabels) || !fits(swappedSecond, otherLabels)) continue;
        placed[i] = swappedFirst;
        placed[j] = swappedSecond;
        improved = true;
      }
    }
    if (!improved) break;
  }
  return placed;
}
