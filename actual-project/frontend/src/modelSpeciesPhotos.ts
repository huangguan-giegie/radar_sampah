/** Modelled marine species photo references. Verified file pages on Wikimedia Commons.
 * Real specimen / species-reference images; none claim a sighting at the selected beach.
 * Licences and photographer credits are linked to each original file page.
 * External photos are deliberately not represented as bundled model assets.
 */
const COMMONS_FILES: Record<string, string> = {
  "Moon wrasse": "Thalassoma lunare.jpg",
  "Copperband butterflyfish": "Chelmon rostratus Kupferstreifen-Pinzettfisch.jpg",
  "Bluespotted fantail ray": "Taeniura lymma.JPG",
  "Golden trevally": "Gnathanodon speciosus 1.jpg",
  "Blue sea star": "Linckia laevigata Linnaeus (AM MA101170-4).jpg",
  "Knobbly sea star": "Protoreaster nodosus.jpg",
  "Longspine sea urchin": "Diadema-setosum.jpg",
  "Lollyfish": "Holothuria atra Thailand.jpg",
  "Tiger moon snail": "Naturalis Biodiversity Center - RMNH.MOL.189925 - Paratectonatica tigrina (Röding, 1798) - Naticidae - Mollusc shell.jpeg",
  "Tiger cowrie": "Cypraea tigris (tiger cowrie) 1 (24831836172).jpg",
  "Red-necked stint": "Calidris ruficollis.jpg",
  "Indo-Pacific sergeant": "Abudefduf vaigiensis.jpg",
  "Orange-spotted spinefoot": "Siganus guttatus.JPG",
  "Giant moray": "Gymnothorax javanicus.jpg",
  "Blackspotted puffer": "Arothron nigropunctatus.jpg",
  "Bluebarred parrotfish": "Scarus ghobban.jpg",
  "Common lionfish": "Pterois volitans.jpg",
  "Broadclub cuttlefish": "Ascarosepion de arrecife (Ascarosepion latimanus), Anilao, Filipinas, 2023-08-22, DD 48.jpg",
  "Boring giant clam": "Tridacna crocea.jpg",
  "Anna's Chromodoris": "Chromodoris annae.jpg",
  "Varicose wart slug": "Phyllidia varicosa.jpg",
  "Red-banded coral shrimp": "Stenopus hispidus.jpg",
  "Magnificent sea anemone": "Heteractis magnifica 1.jpg",
  "Galaxy coral": "Galaxea fascicularis.jpg",
  "Giant barrel sponge": "Barrel Sponge (Xestospongia testudinaria) (8500727224).jpg",
  "Bridled tern": "Bridled tern (Onychoprion anaethetus).jpg",
  "Painted spiny lobster": "Panulirus versicolor.jpg",
  "Yellow-lipped sea krait": "Laticauda colubrina.jpg",
  "Banded sea urchin": "Echinothrix calamaris.JPG",
  "Greenfish": "Stichopus chloronotus.jpg",
  "Elongate giant clam": "Tridacna maxima 1.jpg",
  "Blue-ringed angelfish": "Pomacanthus annularis 1.jpg",
  "Threespot humbug": "Dascyllus trimaculatus 482368800.jpg",
  "Two-line monocle bream": "Scolopsis bilineata.JPG",
  "Eightband butterflyfish": "Bep chaetodon octofasciatus.jpg"
};

export type PhotoReference = { image: string; creditsUrl: string; note: string };
export function modelSpeciesPhoto(name: string): PhotoReference | null {
  const file = COMMONS_FILES[name];
  if (!file) return null;
  const filePath = encodeURIComponent(file.replace(/ /g, "_"));
  return {
    image: `https://commons.wikimedia.org/wiki/Special:FilePath/${filePath}?width=600`,
    creditsUrl: `https://commons.wikimedia.org/wiki/File:${filePath}`,
    note: name === "Tiger moon snail" || name === "Tiger cowrie" || name === "Blue sea star"
      ? "Museum specimen or shell reference photo" : "Species reference photo",
  };
}

export const MODEL_SPECIES_WITH_NEW_PHOTOS = Object.keys(COMMONS_FILES);
