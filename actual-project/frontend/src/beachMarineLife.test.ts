import { describe, expect, it } from 'vitest';
import { beachMarineCards } from './beachMarineLife';
import { MARINE_PIN_REFERENCES, regionalMarinePins } from './biodiversity';

describe('beach marine life from map references and API evidence', () => {
  it('keeps each regional photo available from its associated beach', () => {
    for (const region of Object.keys(MARINE_PIN_REFERENCES)) {
      for (const pin of regionalMarinePins(region, [])) {
        expect(beachMarineCards(pin.beachId).some(card => card.id === pin.record.speciesId)).toBe(true);
      }
    }
  });

  it('does not move a Balok horseshoe crab record to Paya on Tioman', () => {
    expect(beachMarineCards('pantai-paya-tioman').map(card => card.id)).toEqual(['corals']);
    expect(beachMarineCards('pantai-balok').map(card => card.id)).toEqual(['horseshoe-crab']);
    expect(beachMarineCards('pantai-juara-tioman').map(card => card.id)).toEqual(['hawksbill-turtle']);
  });

  it('keeps individually curated pilot references with species-guide navigation', () => {
    const cards = beachMarineCards('morib');
    expect(cards.map(card => card.id)).toContain('grubeulepis-malayensis');
    expect(cards.map(card => card.id)).toContain('tube-dwelling-worm');
    expect(cards.every(card => card.destination.endsWith('?beach=morib'))).toBe(true);
  });

  it('shows one photo with both sources when a model matches a published species', () => {
    const cards = beachMarineCards('kelanang', [
      { name: 'Thalassina kelanang', scientificName: 'Thalassina kelanang', evidenceType: 'modelled' },
      { name: 'Thalassina kelanang', scientificName: 'Thalassina kelanang', evidenceType: 'published_reference' },
    ]);
    const matching = cards.filter(card => card.id === 'thalassina-kelanang');
    expect(matching).toHaveLength(1);
    expect(matching[0]).toMatchObject({ published: true, modelled: true });
    expect(matching[0].image).toContain('thalassina-kelanang');
  });

  it('retains additional model-only species and their introduction route', () => {
    const cards = beachMarineCards('morib', [
      { name: 'Greenfish', scientificName: 'Stichopus chloronotus', evidenceType: 'modelled' },
    ]);
    expect(cards.some(card => card.id === 'tube-dwelling-worm')).toBe(true);
    const model = cards.find(card => card.modelled)!;
    expect(model.published).toBe(false);
    expect(model.destination).toBe('/model-species/stichopus-chloronotus?beach=morib');
  });

  it('leaves beaches without a specific reference empty until API evidence is available', () => {
    expect(beachMarineCards('pantai-air-batang-tioman')).toEqual([]);
    expect(beachMarineCards('unknown')).toEqual([]);
    expect(beachMarineCards('unknown', [{ name: 'API species', evidenceType: 'published_reference' }]))
      .toHaveLength(1);
  });
});
