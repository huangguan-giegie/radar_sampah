import { describe, expect, it } from "vitest";
import content from "./content/coastalContent.json";
import { CATALOGUE_MAP_LOCATIONS, getLocatedMapBeaches, PRIMARY_MAP_BEACHES } from "./mapCatalogue";
import { hasMapCoordinates } from "./mapGeometry";

const pilotIds = new Set(["morib", "remis", "kelanang", "bagan"]);

describe("catalogue map positions", () => {
  it("keeps all nine prototype regions' main beach labels addressable", () => {
    expect(Object.keys(PRIMARY_MAP_BEACHES)).toHaveLength(9);
    for (const [region, ids] of Object.entries(PRIMARY_MAP_BEACHES)) {
      for (const id of ids) {
        expect(content.beaches.find(b => b.id === id)?.region).toBe(region);
        expect(pilotIds.has(id) || hasMapCoordinates(CATALOGUE_MAP_LOCATIONS[id])).toBe(true);
      }
    }
  });

  it("does not turn display coordinates into operational beach coordinates", () => {
    const beach = { id: "pantai-cenang", lat: null, lng: null, previewOnly: true };
    expect(getLocatedMapBeaches([beach], true)).toHaveLength(1);
    expect(getLocatedMapBeaches([beach], false)).toEqual([]);
    expect(getLocatedMapBeaches([{ ...beach, previewOnly: false }], true)).toEqual([]);
    expect(beach).toEqual({ id: "pantai-cenang", lat: null, lng: null, previewOnly: true });
  });

  it("preserves valid API locations and rejects unknown or invalid positions", () => {
    const live = { id: "pantai-cenang", lat: 6.3, lng: 99.7, previewOnly: false };
    expect(getLocatedMapBeaches([live], true)[0]).toBe(live);
    expect(getLocatedMapBeaches([live], false)[0]).toBe(live);
    expect(getLocatedMapBeaches([{ ...live, id: "unknown", lat: NaN }], true)).toEqual([]);
  });

  it("keeps a named source and valid Malaysia-area position for every display record", () => {
    const ids = new Set(content.beaches.map(b => b.id));
    for (const [id, point] of Object.entries(CATALOGUE_MAP_LOCATIONS)) {
      expect(ids.has(id)).toBe(true);
      expect(hasMapCoordinates(point)).toBe(true);
      expect(point.lat).toBeGreaterThan(0.5);
      expect(point.lat).toBeLessThan(7.6);
      expect(point.lng).toBeGreaterThan(99);
      expect(point.lng).toBeLessThan(120);
      expect(point.sourceUrl).toMatch(/^https:\/\//);
      expect(point.sourceName.length).toBeGreaterThan(5);
    }
  });

  it("covers every catalogue beach without replacing the four API pilot locations", () => {
    expect(Object.keys(CATALOGUE_MAP_LOCATIONS)).toHaveLength(97);
    for (const beach of content.beaches) {
      expect(pilotIds.has(beach.id) || hasMapCoordinates(CATALOGUE_MAP_LOCATIONS[beach.id])).toBe(true);
    }
  });
});
