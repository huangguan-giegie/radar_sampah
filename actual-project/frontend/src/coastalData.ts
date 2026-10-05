import { getBeaches, USE_MOCK } from "./api";
import content from "./content/coastalContent.json";
import type { SeverityBand } from "./types";

export const REGIONS = [
  {
    id: "north",
    name: "Perlis, Kedah & Penang",
    lat: 6.05,
    lng: 100.3,
    zoom: 8,
  },
  { id: "perak", name: "Perak", lat: 4.65, lng: 100.7, zoom: 9 },
  { id: "selangor", name: "Selangor", lat: 3.1, lng: 101.3, zoom: 9 },
  {
    id: "nsm",
    name: "Negeri Sembilan & Melaka",
    lat: 2.3,
    lng: 102.1,
    zoom: 9,
  },
  { id: "johor", name: "Johor", lat: 1.85, lng: 103.8, zoom: 8 },
  { id: "pahang", name: "Pahang", lat: 3.7, lng: 103.35, zoom: 8 },
  { id: "tganu", name: "Terengganu", lat: 5.15, lng: 103.1, zoom: 8 },
  { id: "kelantan", name: "Kelantan", lat: 6.1, lng: 102.3, zoom: 9 },
  { id: "borneo", name: "Sabah & Sarawak", lat: 4, lng: 114.4, zoom: 6 },
];
export interface CoastalBeach {
  id: string;
  name: string;
  area: string;
  region: string;
  severity: SeverityBand | null;
  validReports: number;
  lat: number | null;
  lng: number | null;
  image: string | null;
  previewOnly: boolean;
}
/** Only API coordinates become beach pins. Region centres describe broad areas. */
export async function getCoastalBeaches(): Promise<CoastalBeach[]> {
  const live = await getBeaches();
  const rows: CoastalBeach[] = live.map((b) => ({
    id: b.id,
    name: b.name,
    area: b.area,
    region: (b as typeof b & { region?: string }).region ?? content.beaches.find((x) => x.id === b.id)?.region ?? "",
    severity: b.insufficientData ? null : b.severity,
    validReports: b.validReports,
    lat: b.lat,
    lng: b.lng,
    image:
      b.coverImageUrl ??
      content.beaches.find((x) => x.id === b.id)?.image ??
      null,
    previewOnly: false,
  }));
  if (USE_MOCK)
    for (const b of content.beaches) {
      if (!rows.some((x) => x.id === b.id))
        rows.push({
          id: b.id,
          name: b.name,
          area: b.area,
          region: b.region,
          severity: b.severity as SeverityBand | null,
          validReports: b.validReports,
          lat: null,
          lng: null,
          image: b.image,
          previewOnly: true,
        });
    }
  return rows;
}
