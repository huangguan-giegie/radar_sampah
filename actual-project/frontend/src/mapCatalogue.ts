import base from "./content/mapLocationsBase.json";
import north from "./content/mapLocationsNorth.json";
import east from "./content/mapLocationsEast.json";
import west from "./content/mapLocationsWest.json";
import { hasMapCoordinates } from "./mapGeometry";

export interface CatalogueMapLocation {
  lat: number;
  lng: number;
  sourceUrl: string;
  sourceName: string;
}

// Display-only locations for the frontend catalogue. Never used for report,
// check-in, cleanup eligibility or API beach registration.
export const CATALOGUE_MAP_LOCATIONS: Record<string, CatalogueMapLocation> = {
  ...base, ...north, ...east, ...west,
};

export const PRIMARY_MAP_BEACHES: Record<string, readonly string[]> = {
  north: ["pantai-kuala-perlis", "pantai-cenang", "pantai-merdeka", "pantai-batu-ferringhi", "pantai-bersih"],
  selangor: ["pantai-bagan-nakhoda-omar", "pantai-redang", "remis", "morib", "kelanang", "pantai-tanjung-rhu-pulau-carey", "bagan"],
  perak: ["pantai-pasir-panjang-segari", "pantai-teluk-senangin", "pantai-pasir-bogak", "pantai-teluk-batik"],
  nsm: ["pantai-tanjung-gemuk", "pantai-cahaya-negeri", "pantai-pengkalan-balak", "teluk-kemang", "pantai-siring", "pantai-kundor", "pulau-besar-melaka"],
  johor: ["pantai-teluk-gorek", "pantai-semanyir", "pulau-tinggi", "pasir-gemang", "pantai-stulang", "pantai-minyak-beku", "pantai-desaru"],
  kelantan: ["pantai-cahaya-bulan", "pantai-senok", "pantai-kuda", "pantai-irama", "pantai-tok-bali", "pantai-bisikan-bayu"],
  tganu: ["chagar-hutang-redang", "pantai-penarik", "pantai-batu-buruk", "pulau-kapas", "pantai-teluk-lipat", "pantai-kemasik"],
  pahang: ["pantai-cherating", "teluk-cempedak", "pantai-air-batang-tioman", "pantai-paya-tioman"],
  borneo: ["pantai-kelambu", "pantai-tanjung-aru", "pantai-tanjong-lobang", "pantai-damai", "pantai-tanjong-batu"],
};

type BeachMapInput = { id: string; lat: number | null; lng: number | null; previewOnly: boolean };

export function getLocatedMapBeaches<T extends BeachMapInput>(
  beaches: readonly T[],
  preview: boolean,
): Array<T & { lat: number; lng: number }> {
  return beaches.flatMap(beach => {
    if (hasMapCoordinates(beach)) return [beach];
    const location = preview && beach.previewOnly ? CATALOGUE_MAP_LOCATIONS[beach.id] : undefined;
    return location && hasMapCoordinates(location)
      ? [{ ...beach, lat: location.lat, lng: location.lng }]
      : [];
  });
}
