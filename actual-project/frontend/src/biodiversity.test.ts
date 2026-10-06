import { describe, expect, it } from "vitest";
import content from "./content/coastalContent.json";
import { groupMarineRecords, marineAreaPath, marineRecordDetails, regionalMarinePins, overviewMarinePins, originBeachId, withBeach, MARINE_PIN_REFERENCES } from "./biodiversity";

const pilots = [{ id: "morib", lat: 2.751, lng: 101.442 }, { id: "remis", lat: 3.2, lng: 101.31 }];
describe("prototype biodiversity navigation", () => {
  it("opens the selected species first without losing distinct published places", () => {
    const johor = content.regions.find(r => r.id === "johor")!;
    const groups = groupMarineRecords(johor.records, "seagrass");
    expect(groups.map(group => group.id)).toEqual(["seagrass", "dugong"]);
    expect(groups[0].records.map(record => record.place)).toEqual(["Pulau Sibu", "Merambong, Sungai Pulai"]);
    expect(groups.flatMap(group => group.records)).toHaveLength(johor.records.length);
    expect(groupMarineRecords(johor.records, "unknown")[0].id).toBe("dugong");
    expect(marineAreaPath("johor", "seagrass")).toBe("/marine-area/johor?species=seagrass");
    expect(marineAreaPath("johor", "dugong", "pulau-tinggi")).toBe("/marine-area/johor?species=dugong&beach=pulau-tinggi");
  });
  it("resolves every regional pin to its own record and species introduction", () => {
    const counts = [2, 2, 3, 2, 1, 1, 2, 2, 1];
    Object.keys(MARINE_PIN_REFERENCES).forEach((region, i) => {
      const pins = regionalMarinePins(region, pilots);
      expect(pins).toHaveLength(counts[i]);
      for (const pin of pins) {
        expect(content.species.some(s => s.id === pin.record.speciesId)).toBe(true);
        expect(Number.isFinite(pin.lat) && Number.isFinite(pin.lng)).toBe(true);
        expect(pin.record.name).toBe(content.regions.find(r => r.id === region)!.records[pin.index].name);
      }
    });
  });
  it("keeps all six national picture pins with their area destination", () => {
    const pins = overviewMarinePins(pilots);
    expect(pins).toHaveLength(6);
    for (const pin of pins) {
      expect(pin.image).toBeTruthy();
      expect(content.regions.some(r => r.id === pin.regionId)).toBe(true);
    }
  });
  it("links habitat cards to specific habitats and normalizes source aliases", () => {
    for (const region of content.regions) for (const record of region.records) {
      const details = marineRecordDetails(record);
      if (details.habitatId) expect(content.habitats.some(h => h.id === details.habitatId)).toBe(true);
      expect(content.species.some(s => s.id === details.speciesId)).toBe(true);
    }
    const kemang = content.regions.find(r => r.id === "nsm")!.records[1];
    expect(marineRecordDetails(kemang).speciesId).toBe("syringodium-isoetifolium");
  });
  it("preserves a valid originating beach without attaching a different region's beach", () => {
    expect(originBeachId("morib", "selangor")).toBe("morib");
    expect(originBeachId("morib", "north")).toBeUndefined();
    expect(originBeachId("unknown")).toBeUndefined();
    expect(withBeach("/map?layer=bio&region=selangor", "morib")).toBe("/map?layer=bio&region=selangor&beach=morib");
  });
});
