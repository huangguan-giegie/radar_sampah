import { beforeEach, describe, expect, it, vi } from "vitest";
import content from "./content/coastalContent.json";
import expandedBeachRegions from "./content/expandedBeachRegions.json";
import type { BeachSummary } from "./types";

vi.mock("./api", () => ({ USE_MOCK: false, getBeaches: vi.fn() }));

import { getBeaches } from "./api";
import { getCoastalBeaches, REGIONS } from "./coastalData";

const catalogueIds = [...new Set([...content.beaches.map((beach) => beach.id), ...Object.keys(expandedBeachRegions)])];
const apiRows = catalogueIds.map((id) => ({
  id,
  name: id,
  area: "Malaysia",
  region: undefined,
  lat: null,
  lng: null,
  validReports: 0,
  insufficientData: true,
})) as unknown as BeachSummary[];

beforeEach(() => vi.mocked(getBeaches).mockReset());

describe("live coastal catalogue", () => {
  it("classifies every live beach when the production API omits region", async () => {
    vi.mocked(getBeaches).mockResolvedValue(apiRows);
    const beaches = await getCoastalBeaches();
    expect(beaches).toHaveLength(179);
    expect(new Set(beaches.map((beach) => beach.id)).size).toBe(179);
    expect(Object.fromEntries(REGIONS.map((region) => [region.id, beaches.filter((beach) => beach.region === region.id).length])))
      .toEqual({ north: 27, perak: 8, selangor: 14, nsm: 11, johor: 37, pahang: 18, tganu: 26, kelantan: 8, borneo: 30 });
    expect(beaches.find((beach) => beach.id === "bs-adverlabs-beach-64")?.region).toBe("north");
    expect(beaches.find((beach) => beach.id === "bs-adam-and-eve-beach-28")?.region).toBe("tganu");
  });

  it("keeps the compact region lookup consistent with the reviewed catalogue", () => {
    expect(Object.keys(expandedBeachRegions)).toHaveLength(82);
    expect(catalogueIds).toHaveLength(179);
    const regions = new Map(content.beaches.map((beach) => [beach.id, beach.region]));
    for (const [id, region] of Object.entries(expandedBeachRegions)) {
      expect(REGIONS.some((item) => item.id === region)).toBe(true);
      if (regions.has(id)) expect(regions.get(id)).toBe(region);
    }
  });

  it("respects valid API regions and preserves rows without coordinates", async () => {
    vi.mocked(getBeaches).mockResolvedValue([
      { ...apiRows[0], region: "pahang" },
      { ...apiRows[0], id: "bs-adverlabs-beach-64", region: "", lat: null, lng: null },
    ]);
    const beaches = await getCoastalBeaches();
    expect(beaches).toHaveLength(2);
    expect(beaches[0].region).toBe("pahang");
    expect(beaches[1]).toMatchObject({ region: "north", lat: null, lng: null, previewOnly: false });
  });
});
