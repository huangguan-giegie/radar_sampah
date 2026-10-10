import content from "./content/coastalContent.json";
import { CATALOGUE_MAP_LOCATIONS } from "./mapCatalogue";
import { hasMapCoordinates } from "./mapGeometry";

export type MarineRecord = { name: string; place: string; description: string; speciesId: string | null; image: string | null };

// Explicit destinations from the region record cards in the Figma handoff.
const HABITATS_BY_PLACE: Record<string, string> = {
  "Kilim, Langkawi": "langkawi", "Kuala Gula, Matang": "matang",
  "Pantai Morib": "morib-mudflat", "Morib Mudflat": "morib-mudflat",
  "Pulau Tinggi": "pulau-tinggi", "Merambong, Sungai Pulai": "sungai-pulai",
  "Setiu Wetlands": "setiu", "Kuching Wetlands": "kuching-wetlands",
  "Lawas coast": "lawas", "Sandakan Bay": "sandakan-bay",
};

export function marineRecordDetails(record: MarineRecord) {
  const speciesId = record.name === "Mangrove restoration" ? "mangroves"
    : record.name === "Seagrass meadows" ? "seagrass"
    : record.place === "Teluk Kemang" && record.name === "Seagrass" ? "syringodium-isoetifolium"
    : record.speciesId;
  const species = content.species.find(s => s.id === speciesId);
  const restoration = content.photos.find(p => p.name === "Mangrove illustration");
  return { ...record, speciesId, habitatId: HABITATS_BY_PLACE[record.place],
    image: record.name === "Mangrove restoration" ? restoration?.image ?? null : record.image ?? species?.image ?? null };
}

export function originBeachId(value: string | null, regionId?: string) {
  return content.beaches.find(b => b.id === value && (!regionId || b.region === regionId))?.id;
}
export function withBeach(path: string, beachId?: string) {
  return beachId ? path + (path.includes("?") ? "&" : "?") + "beach=" + encodeURIComponent(beachId) : path;
}

export function marineAreaPath(regionId: string, speciesId: string | null, beachId?: string) {
  return withBeach("/marine-area/" + regionId + (speciesId ? "?species=" + encodeURIComponent(speciesId) : ""), beachId);
}

export function groupMarineRecords(records: readonly MarineRecord[], selectedSpeciesId?: string | null) {
  const groups = new Map<string, { id: string; name: string; records: MarineRecord[] }>();
  for (const record of records) {
    const item = marineRecordDetails(record);
    const id = item.speciesId ?? record.name;
    const group = groups.get(id);
    if (group) group.records.push(record);
    else groups.set(id, { id, name: content.species.find(s => s.id === id)?.name ?? record.name, records: [record] });
  }
  return [...groups.values()].sort((a, b) => Number(b.id === selectedSpeciesId) - Number(a.id === selectedSpeciesId));
}

// Region-map photo pins: the prototype intentionally displays selected records,
// while the region page retains the complete published record collection.
export const MARINE_PIN_REFERENCES: Record<string, readonly [number, string, string][]> = {
  north: [[1, "pantai-teluk-datai", "Local project · species photo"], [2, "pantai-batu-ferringhi", "Nesting record · 1995–2009 · species photo"]],
  perak: [[1, "pantai-teluk-nipah", "Historical record · species photo"], [2, "pantai-pasir-panjang-segari", "Regional nesting record · species photo"]],
  selangor: [[1, "pantai-sungai-haji-dorani", "Historical coastal study · species photo"], [2, "morib", "Collection study · 2021 · species photo"], [0, "remis", "Shellfish study · 2024 · species photo"]],
  nsm: [[0, "pantai-pengkalan-balak", "Historical nesting record · species photo"], [1, "teluk-kemang", "Species record · 2022 · species photo"]],
  johor: [[0, "pulau-tinggi", "Regional waters · species photo"]],
  kelantan: [[0, "pantai-bisikan-bayu", "Historical record · species photo"]],
  tganu: [[1, "pulau-kapas", "Island waters · species photo"], [0, "chagar-hutang-redang", "Bay research · species photo"]],
  pahang: [[1, "pantai-juara-tioman", "Historical area record · species photo"], [0, "pantai-balok", "Historical spawning record · species photo"]],
  borneo: [[1, "pulau-mantanani", "Island waters · species photo"]],
};

type LocatedBeach = { id: string; lat: number | null; lng: number | null };
export function regionalMarinePins(regionId: string, beaches: readonly LocatedBeach[]) {
  const region = content.regions.find(r => r.id === regionId);
  return (MARINE_PIN_REFERENCES[regionId] ?? []).flatMap(([index, beachId, caption]) => {
    const position = beaches.find(b => b.id === beachId) ?? CATALOGUE_MAP_LOCATIONS[beachId];
    const location = hasMapCoordinates(position) ? position : CATALOGUE_MAP_LOCATIONS[beachId];
    const record = region?.records[index];
    return record && hasMapCoordinates(location) ? [{ id: `${regionId}-${index}`, regionId, beachId, index, caption,
      record: marineRecordDetails(record), lat: location.lat, lng: location.lng }] : [];
  });
}

// Broad habitat navigation references, not individual animal observation points.
// Matang: forestry.gov.my/en/perak/pusat-eko-pelajaran-hutan-paya-laut-matang
// Setiu: marineregions.org/gazetteer.php?id=30438&p=details
// Kilim: openstreetmap.org/way/987444012; Pulai: Ramsar site 1288 (01°23'N 103°32'E).
export const OVERVIEW_MARINE_PINS = [
  { id: "langkawi", name: "CRABS", regionId: "north", speciesId: "mangrove-crabs", lat: 6.3852, lng: 99.8772 },
  { id: "setiu", name: "TERRAPINS", regionId: "tganu", speciesId: "painted-terrapin", lat: 5.66, lng: 102.73 },
  { id: "matang", name: "MUDSKIPPER", regionId: "perak", speciesId: "giant-mudskipper", lat: 4.8402, lng: 100.6356 },
  { id: "morib", name: "WORMS", regionId: "selangor", speciesId: "tube-dwelling-worm", beachId: "morib" },
  { id: "pulau-tinggi", name: "DUGONG", regionId: "johor", speciesId: "dugong", beachId: "pulau-tinggi" },
  { id: "sungai-pulai", name: "SEAGRASS", regionId: "johor", speciesId: "seagrass", lat: 1.383333, lng: 103.533333 },
];
export function overviewMarinePins(beaches: readonly LocatedBeach[]) {
  return OVERVIEW_MARINE_PINS.flatMap(pin => {
    const location = "beachId" in pin ? beaches.find(b => b.id === pin.beachId) ?? CATALOGUE_MAP_LOCATIONS[pin.beachId!] : pin;
    const species = content.species.find(s => s.id === pin.speciesId);
    return hasMapCoordinates(location) ? [{ ...pin, image: species?.image ?? null, lat: location.lat, lng: location.lng }] : [];
  });
}
