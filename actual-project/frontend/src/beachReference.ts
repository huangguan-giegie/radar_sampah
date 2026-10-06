import content from "./content/coastalContent.json";
import references from "./content/beachReferences.json";

type BeachReference = { cards: string[]; caption?: string; source?: string };
const beachReferences: Record<string, BeachReference> = references;
const speciesAliases: Record<string, string> = {
  "Green turtle": "green-sea-turtle",
  "Scaleworm": "grubeulepis-malayensis",
  "Mud lobster": "thalassina-kelanang",
  "Finless porpoise": "indo-pacific-finless-porpoise",
  "Syringodium": "syringodium-isoetifolium",
  "Rhizophora": "rhizophora-stylosa",
  "Turtle nesting coast": "sea-turtles",
};
const habitatPhotos: Record<string, string> = {
  "Mangrove restoration": "mangroves",
  "Coral restoration": "corals",
  "Coral habitat": "corals",
  "Reef research": "corals",
  "Pulau Tiga reefs": "corals",
  "Tioman coral habitat": "corals",
  "Seagrass meadows": "seagrass",
};

/** Published reference context is separate from the beach's live litter data. */
export function beachReference(beachId: string) {
  const reference = beachReferences[beachId];
  if (!reference) return null;
  return {
    ...reference,
    cards: reference.cards.map(name => {
      const habitat = habitatPhotos[name];
      const speciesId = speciesAliases[name] ?? habitat;
      const species = content.species.find(item => speciesId
        ? item.id === speciesId
        : item.name.toLowerCase() === name.toLowerCase());
      const image = name === "Mangrove restoration"
        ? content.photos.find(photo => photo.name === "Mangrove illustration")?.image ?? species?.image ?? null
        : species?.image ?? null;
      return { name, image, speciesId: habitat ? null : species?.id ?? null };
    }),
  };
}
