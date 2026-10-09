import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelSpeciesPicture, modelSpeciesGroup, selectOpenTaxonPhoto } from "./components/ModelSpeciesPicture";

describe("wildlife model illustrations and licensed photography", () => {
  it("never displays a similarly named but different taxon or a non-openly licensed photo", () => {
    const results = [
      { id: 1, name: "Chelonia mydas mydas", default_photo: { license_code: "cc-by", medium_url: "https://example.org/wrong.jpg" } },
      { id: 2, name: "Chelonia mydas", default_photo: { license_code: "cc-by-nc", medium_url: "https://example.org/restricted.jpg" } },
    ];
    expect(selectOpenTaxonPhoto(results, "Chelonia mydas")).toBeNull();
    const free = [{ id: 3, name: "Chelonia mydas", default_photo: {
      id: 1234, license_code: "cc-by", medium_url: "https://example.org/open.jpg", attribution: "Photo: Author",
    }}];
    expect(selectOpenTaxonPhoto(free, "Chelonia mydas")).toEqual({
      url: "https://example.org/open.jpg", credit: "Photo: Author", licence: "CC-BY",
      sourceUrl: "https://www.inaturalist.org/photos/1234", kind: "open_photo",
    });
  });

  it("has a scientifically broad, explicitly labelled illustration fallback for the model genera", () => {
    const genera = [
      ["Chelonia mydas", "turtle"], ["Orcaella brevirostris", "dolphin"],
      ["Taeniura lymma", "ray"], ["Linckia laevigata", "starfish"],
      ["Diadema setosum", "urchin"], ["Tridacna maxima", "clam"],
      ["Stenopus hispidus", "shrimp"], ["Chromodoris annae", "nudibranch"],
      ["Neophocaena phocaenoides", "dolphin"], ["Scolopsis bilineata", "fish"],
    ];
    for (const [name, group] of genera) {
      expect(modelSpeciesGroup(name)).toBe(group);
      const markup = renderToStaticMarkup(<ModelSpeciesPicture name={name} scientificName={name} />);
      expect(markup).toContain("<svg");
      expect(markup).toContain("AI-generated group illustration");
      expect(markup).not.toContain("confirmed sighting");
    }
  });
});
