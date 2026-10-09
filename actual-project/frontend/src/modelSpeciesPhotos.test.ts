import { describe, expect, it } from 'vitest';
import content from './content/coastalContent.json';
import { MODEL_SPECIES_MEDIA } from './speciesMedia';
import { MODEL_SPECIES_WITH_NEW_PHOTOS, modelSpeciesPhoto } from './modelSpeciesPhotos';
import { speciesPhoto, speciesPhotoReference } from './visuals';

describe('marine-model species imagery coverage', () => {
  it('provides species-accurate photographs with source links for all 40 packaged model names', () => {
    // Keep this test within src/: Docker's frontend build copies no backend JSON.
    const curated = ['Green sea turtle', 'Ocellaris clownfish', 'Irrawaddy dolphin',
      'Moorish idol', 'Indo-Pacific finless porpoise'];
    const names = [...MODEL_SPECIES_WITH_NEW_PHOTOS, ...curated];
    expect(MODEL_SPECIES_WITH_NEW_PHOTOS).toHaveLength(35);
    expect(MODEL_SPECIES_MEDIA).toHaveLength(4);
    expect(names).toHaveLength(40);
    expect(new Set(names).size).toBe(40);
    for (const name of names) {
      const photo = speciesPhotoReference(name);
      expect(photo, name).not.toBeNull();
      expect(photo?.image, name).toBeTruthy();
      expect(speciesPhoto(name)).toBe(photo?.image);
      expect(photo?.creditsUrl, name).toBeTruthy();
      if (modelSpeciesPhoto(name)) {
        expect(photo?.creditsUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
        expect(photo?.image).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//);
      }
    }
  });

  it('also covers every distinct published species or ecological group in the 101 curated beaches', () => {
    const ids = [...new Set(content.beaches.flatMap(beach => beach.species))];
    expect(content.beaches).toHaveLength(101);
    expect(ids).toHaveLength(25);
    for (const id of ids) {
      const species = content.species.find(item => item.id === id);
      expect(species, id).toBeTruthy();
      expect(speciesPhoto(species!.name), species!.name).toBeTruthy();
      expect(speciesPhotoReference(species!.name)?.creditsUrl, species!.name).toBeTruthy();
    }
  });

  it('does not borrow an unrelated photo when a species name is unknown', () => {
    expect(modelSpeciesPhoto('Unidentified fictional animal')).toBeNull();
    expect(speciesPhoto('Unidentified fictional animal')).toBeNull();
  });
});
