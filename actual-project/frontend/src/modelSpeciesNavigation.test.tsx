import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import appSource from './App.tsx?raw';
import { beachMarineCards } from './beachMarineLife';
import { findModelSpecies, modelSpeciesDestination, scientificNameKey } from './modelSpeciesNavigation';
import type { SpeciesCatalog } from './types';

const state = vi.hoisted(() => ({ data: null as SpeciesCatalog | null }));
vi.mock('./useAsyncData', () => ({
  useAsyncData: () => ({ data: state.data, loading: false, error: null, refresh: vi.fn() }),
}));

import ModelSpeciesScreen from './screens/ModelSpeciesScreen';

const greenfish = {
  speciesSlug: 'stichopus_chloronotus', scientificName: 'Stichopus chloronotus',
  commonNameEn: 'Greenfish', category: 'sea_cucumber',
  introEn: 'Dark green sea cucumbers inhabit shallow coral reef flats.',
  introZh: '深绿色海参生活于浅水珊瑚礁。',
  sources: [{ title: 'FAO: Greenfish', url: 'https://www.fao.org/4/i1918e/i1918e.pdf' }],
  imageAvailable: false, recordYears: { min: 1998, max: 2026 },
};
const angelfish = {
  speciesSlug: 'pomacanthus_annularis', scientificName: 'Pomacanthus annularis',
  commonNameEn: 'Blue-ringed angelfish', category: 'reef_angelfish',
  introEn: 'Adult angelfish show curved blue stripes and inhabit coral reefs.',
  introZh: '成年鱼有蓝色条纹。',
  sources: [{ title: 'Australian Museum: Blue-ringed Angelfish', url: 'https://australian.museum/learn/animals/fishes/blue-ringed-angelfish-pomacanthus-annularis/' }],
  imageAvailable: false, recordYears: { min: 1963, max: 2026 },
};

beforeEach(() => {
  state.data = {
    modelVersion: 'obis-historical-40', modelCount: 40,
    scoreType: 'relative_occurrence', calibratedProbability: false,
    crossSpeciesRankingValidated: false, species: [greenfish, angelfish],
  };
});

function render(url: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/model-species/:scientificKey" element={<ModelSpeciesScreen />} /></Routes>
    </MemoryRouter>,
  );
}

describe('beach wildlife species introduction navigation', () => {
  it('routes both screenshot species to their own guide and preserves the original beach', () => {
    const beach = 'bs-pasir-panjang-9';
    expect(modelSpeciesDestination('Stichopus chloronotus', beach))
      .toBe('/model-species/stichopus-chloronotus?beach=bs-pasir-panjang-9');
    expect(modelSpeciesDestination('Pomacanthus annularis', beach))
      .toBe('/model-species/pomacanthus-annularis?beach=bs-pasir-panjang-9');
    expect(appSource).toContain('<Route path="/model-species/:scientificKey" element={<ModelSpeciesScreen />}');
    const cards = beachMarineCards(beach, [greenfish, angelfish].map(species => ({
      name: species.commonNameEn, scientificName: species.scientificName, evidenceType: 'modelled',
    })));
    expect(cards.map(card => card.destination)).toEqual([
      '/model-species/stichopus-chloronotus?beach=bs-pasir-panjang-9',
      '/model-species/pomacanthus-annularis?beach=bs-pasir-panjang-9',
    ]);
  });

  it('renders the Greenfish introduction, its photo, original source and careful evidence label', () => {
    const html = render('/model-species/stichopus-chloronotus?beach=bs-pasir-panjang-9');
    expect(html).toContain('Greenfish');
    expect(html).toContain('Stichopus chloronotus');
    expect(html).toContain('Dark green sea cucumbers inhabit shallow coral reef flats.');
    expect(html).toContain('Stichopus_chloronotus.jpg');
    expect(html).toContain('FAO: Greenfish');
    expect(html).toContain('Back to Beach');
    expect(html).toContain('not a confirmed sighting');
    expect(html).toContain('not occurrence probabilities');
  });

  it('renders the blue-ringed angelfish introduction with its scientific sources', () => {
    const html = render('/model-species/pomacanthus-annularis?beach=bs-pasir-panjang-9');
    expect(html).toContain('Blue-ringed angelfish');
    expect(html).toContain('Pomacanthus annularis');
    expect(html).toContain('Adult angelfish show curved blue stripes');
    expect(html).toContain('Pomacanthus_annularis_1.jpg');
    expect(html).toContain('Australian Museum: Blue-ringed Angelfish');
    expect(html).toContain('Species photograph source');
    expect(html).toContain('Back to Beach');
  });

  it('resolves all catalog entries by scientific key, and preserves exceptional older slugs', () => {
    expect(findModelSpecies(state.data, 'stichopus-chloronotus')?.commonNameEn).toBe('Greenfish');
    expect(findModelSpecies(state.data, 'pomacanthus_annularis')?.commonNameEn).toBe('Blue-ringed angelfish');
    expect(scientificNameKey('Chelonia mydas')).toBe('chelonia-mydas');
    const specialCatalog = { ...state.data!, species: [{ ...greenfish, speciesSlug: 'green_sea_turtle', scientificName: 'Chelonia mydas' }] };
    expect(findModelSpecies(specialCatalog, 'green_sea_turtle')?.scientificName).toBe('Chelonia mydas');
    expect(findModelSpecies(specialCatalog, 'chelonia-mydas')?.scientificName).toBe('Chelonia mydas');
    expect(modelSpeciesDestination(null, 'morib')).toBeNull();
    expect(modelSpeciesDestination('bad#species', 'morib')).toBeNull();
    expect(render('/model-species/fictional-animal')).toContain('Species not found');
  });
});
