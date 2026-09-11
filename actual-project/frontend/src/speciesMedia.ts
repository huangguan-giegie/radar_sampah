import type { SpeciesGlyph } from './types';

/**
 * Curated, reusable media for the four species in the packaged OBIS model.
 *
 * Scientific name is the join key. The backend can change a display label or
 * the order of its predictions without breaking the image match. Attribution
 * travels with the asset so it cannot be separated from the card that uses it.
 */
export interface ModelSpeciesMedia {
  commonName: string;
  scientificName: string;
  glyph: SpeciesGlyph;
  imageUrl: string;
  imageAlt: string;
  imageSourceUrl: string;
  imageAuthor: string;
  imageLicense: string;
  imageLicenseUrl: string;
  imageObjectPosition?: string;
}

export const MODEL_SPECIES_MEDIA: readonly ModelSpeciesMedia[] = [
  {
    commonName: 'Green sea turtle',
    scientificName: 'Chelonia mydas',
    glyph: 'turtle',
    imageUrl: '/species/green-sea-turtle.jpg',
    imageAlt: 'A green sea turtle swimming underwater with small fish in blue water.',
    imageSourceUrl:
      'https://commons.wikimedia.org/wiki/File:Chelonia_mydas_2005-06-11_Andaman_sea.jpg',
    imageAuthor: 'Christoph Schuetzenhofer',
    imageLicense: 'CC BY-SA 3.0',
    imageLicenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  {
    commonName: 'Ocellaris clownfish',
    scientificName: 'Amphiprion ocellaris',
    glyph: 'fish',
    imageUrl: '/species/ocellaris-clownfish.jpg',
    imageAlt: 'Ocellaris clownfish swimming among sea anemones on a coral reef.',
    imageSourceUrl:
      'https://commons.wikimedia.org/wiki/File:Amphiprion_ocellaris_354353067.jpg',
    imageAuthor: 'Zoltán Stekkelpak',
    imageLicense: 'CC0 1.0',
    imageLicenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    commonName: 'Irrawaddy dolphin',
    scientificName: 'Orcaella brevirostris',
    glyph: 'fish',
    imageUrl: '/species/irrawaddy-dolphin.jpg',
    imageAlt: 'An Irrawaddy dolphin emerging from the water, showing its rounded head and flipper.',
    imageSourceUrl:
      'https://commons.wikimedia.org/wiki/File:DKoehl_Irrawaddi_Dolphin_jumping.jpg',
    imageAuthor: 'Dan Koehl',
    imageLicense: 'CC BY 3.0',
    imageLicenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    imageObjectPosition: 'center 45%',
  },
  {
    commonName: 'Moorish idol',
    scientificName: 'Zanclus cornutus',
    glyph: 'fish',
    imageUrl: '/species/moorish-idol.jpg',
    imageAlt: 'A Moorish idol swimming underwater, showing its black, white and yellow bands.',
    imageSourceUrl:
      'https://commons.wikimedia.org/wiki/File:%C3%8Ddolo_moro_(Zanclus_cornutus),_Anilao,_Filipinas,_2023-08-22,_DD_189.jpg',
    imageAuthor: 'Diego Delso',
    imageLicense: 'CC BY-SA 4.0',
    imageLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
];
