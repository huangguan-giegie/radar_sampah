import type { SpeciesCatalog } from "./types";

/**
 * Stable, taxon-specific link independent of a model's display-name slug.
 * Scientific names remain the join key even for the original four species
 * whose packaged speciesSlug is based on their English common name.
 */
export function scientificNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function modelSpeciesDestination(
  scientificName: string | null | undefined,
  beachId?: string,
): string | null {
  if (!scientificName?.trim() || !/^[a-z]+\s+[a-z][a-z -]*$/i.test(scientificName.trim())) return null;
  const path = "/model-species/" + scientificNameKey(scientificName);
  return beachId ? path + "?beach=" + encodeURIComponent(beachId) : path;
}

export function findModelSpecies(catalog: SpeciesCatalog | null, key: string | undefined) {
  if (!catalog || !key) return null;
  return catalog.species.find(
    item => scientificNameKey(item.scientificName) === key || item.speciesSlug === key,
  ) ?? null;
}
