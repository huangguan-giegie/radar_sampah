import { describe, expect, it } from 'vitest';
import catalog from '../../backend/species_distribution/species_catalog.json';
import beachCatalogue from '../../backend/data/beaches.json';
import { MODEL_SPECIES_WITH_NEW_PHOTOS, modelSpeciesPhoto } from './modelSpeciesPhotos';
import { speciesPhoto, speciesPhotoReference } from './visuals';

describe('marine-model species imagery coverage', () => {
  it('provides species-accurate photographs with source links for all 40 packaged model names', () => {
    expect(catalog.species).toHaveLength(40);
    expect(MODEL_SPECIES_WITH_NEW_PHOTOS).toHaveLength(35);
    for (const model of catalog.species) {
      const photo = speciesPhotoReference(model.commonNameEn);
      expect(photo, model.scientificName).not.toBeNull();
      expect(photo?.image, model.commonNameEn).toBeTruthy();
      expect(speciesPhoto(model.commonNameEn)).toBe(photo?.image);
      expect(photo?.creditsUrl).toBeTruthy();
      if (modelSpeciesPhoto(model.commonNameEn)) {
        expect(photo?.creditsUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
        expect(photo?.image).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//);
      }
    }
  });

  it('also covers every distinct published species or ecological group in the 101 curated beaches', () => {
    const names = [...new Set(beachCatalogue.beaches.flatMap(b => b.species.map(s => s.name)))];
    expect(names).toHaveLength(27);
    for (const name of names) {
      expect(speciesPhoto(name), name).toBeTruthy();
      expect(speciesPhotoReference(name)?.creditsUrl, name).toBeTruthy();
    }
  });

  it('does not borrow an unrelated photo when a species name is unknown', () => {
    expect(modelSpeciesPhoto('Unidentified fictional animal')).toBeNull();
    expect(speciesPhoto('Unidentified fictional animal')).toBeNull();
  });
});
