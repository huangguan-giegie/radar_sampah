import content from "./content/coastalContent.json";
import { modelSpeciesPhoto, type PhotoReference } from "./modelSpeciesPhotos";

/**
 * Real photos for places where the UI used to fall back to a drawn glyph.
 * Every file here is already in /public with a known licence (Photo Credits
 * page, images/cleanup/CREDITS.txt, or WelcomeScreen for the Morib dusk photo);
 * show the credit next to any CC BY / BY-SA photo.
 */
export const PHOTOS = {
  volunteers: "/images/cleanup/volunteers.jpg",
  turtle: "/species/green-sea-turtle.jpg",
  moribDusk: "/home/morib-beach-dusk.jpg",
  morib: "/home/pantai-morib.jpg",
  mangrove: "/images/coastal/mangrove-illustration.jpg",
  seagrass: "/images/coastal/seagrass-illustration.jpg",
  reef: "/images/coastal/coral-reef.jpg",
  shorebirds: "/images/coastal/shorebirds.jpg",
} as const;

// The API has no cover image for the pilot beaches; these repo photos are
// the same ones the beach page and Home already fall back to.
const PILOT_PHOTOS: Record<string, string> = {
  morib: PHOTOS.morib,
  bagan: "/images/coastal/pantai-bagan-lalang.jpg",
};

/** A real photo of this beach, or null when the project has none. */
export function beachPhoto(id: string, cover?: string | null): string | null {
  return cover || PILOT_PHOTOS[id] || content.beaches.find((b) => b.id === id)?.image || null;
}

const SPECIES_BY_NAME = new Map(
  content.species.filter((s) => s.image).map((s) => [s.name.toLowerCase(), s.image as string]),
);
// Habitat and group names used in the published reference lists.
const GROUP_PHOTOS: Record<string, string> = {
  "mangrove habitat": PHOTOS.mangrove,
  "mangrove belt": PHOTOS.mangrove,
  "marine fish": "/species/ocellaris-clownfish.jpg", // representative group example, not species identification
  "migratory shorebirds": PHOTOS.shorebirds,
  "mangrove fringe": PHOTOS.mangrove,
  mangroves: PHOTOS.mangrove,
  "seagrass patches": PHOTOS.seagrass,
  seagrass: PHOTOS.seagrass,
  corals: PHOTOS.reef,
  "coastal birds": PHOTOS.shorebirds,
};

/** Photo for a species or habitat named in reference content, if the project has one. */
export function speciesPhoto(name: string): string | null {
  const key = name.trim().toLowerCase();
  return SPECIES_BY_NAME.get(key) ?? modelSpeciesPhoto(name)?.image ?? GROUP_PHOTOS[key] ?? null;
}

/** Photo provenance for a card, including model-only species absent from the curated guide. */
export function speciesPhotoReference(name: string): PhotoReference | null {
  const existing = content.species.find(item => item.name.toLowerCase() === name.toLowerCase());
  if (existing?.image) {
    return { image: existing.image, creditsUrl: existing.photoSource || "/credits",
      note: "Published species reference photo" };
  }
  const model = modelSpeciesPhoto(name);
  if (model) return model;
  const group = GROUP_PHOTOS[name.trim().toLowerCase()];
  return group ? { image: group, creditsUrl: "/credits", note: "Regional habitat example" } : null;
}

/** First species photo of a habitat, so each habitat row shows its own life. */
export function habitatPhoto(habitatId: string): string {
  const habitat = content.habitats.find((h) => h.id === habitatId);
  for (const id of habitat?.species ?? []) {
    const image = content.species.find((s) => s.id === id)?.image;
    if (image) return image;
  }
  return PHOTOS.mangrove;
}

/** First record photo of a marine-life region. */
export function regionPhoto(regionId: string): string | null {
  const region = content.regions.find((r) => r.id === regionId);
  return region?.records.find((r) => r.image)?.image ?? null;
}

/** Position of a point in OpenStreetMap tile units at this zoom. */
export function tilePoint(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}
