import appSource from './App.tsx?raw';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[], modelState: null as any,
  beachId: 'kelanang', lat: 2.789 as number | null, lng: 101.415 as number | null,
  model: vi.fn(),
}));
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect); },
  useState: <T,>(initial: T) => [initial === null ? state.modelState : initial, (value: T) => { state.modelState = value; }],
}));
vi.mock('react-router-dom', async original => ({
  ...await original<typeof import('react-router-dom')>(),
  useParams: () => ({ beachId: state.beachId }),
}));
vi.mock('./api', () => ({
  USE_MOCK: false, getBeach: vi.fn(), getSpeciesDistribution: (...args: unknown[]) => state.model(...args),
}));
vi.mock('./AppContext', () => ({ useApp: () => ({ user: null, draft: {}, reportsVersion: 1 }) }));
vi.mock('./navigation', () => ({ useAppBack: () => vi.fn() }));
vi.mock('./eventAvailability', () => ({ useEventClock: () => Date.now(), eventIsAvailable: () => false }));
vi.mock('./useAsyncData', () => ({
  useAsyncData: (_load: unknown, _dependencies: unknown, initial: unknown) => ({
    data: Array.isArray(initial) ? [] : {
      id: state.beachId, name: 'Pantai Kelanang', area: 'Selangor', lat: state.lat, lng: state.lng,
      severity: null, insufficientData: true, validReports: 0, scene: '#edf2f8', habitat: 'Coastal habitat',
    }, loading: false, error: null, refresh: vi.fn(),
  }),
}));
vi.mock('./components/ConservationCards', () => ({ ConservationCards: () => <section>Approved Conservation Species Cards</section> }));

import CoastalBeachScreen from './screens/CoastalBeachScreen';

function modelResult() {
  const predictions = Array.from({ length: 40 }, (_, index) => ({
    speciesSlug: 'species-' + index, scientificName: 'Scientific species ' + index, commonNameEn: 'Model species ' + index,
    locationMatchScore: 0.9 - index * 0.01, relativeOccurrenceScore: 0.05, defaultRecommendation: true,
    introEn: 'A species from the upgraded package.', sources: [{ title: 'Species source', url: 'https://obis.org/' }],
    recordYears: { min: 1996, max: 2003 },
  }));
  return { predictions, topPredictions: predictions.slice(0, 5), modelVersion: 'iteration3-40',
    coordinateContext: { requestedLatitude: 2.789, requestedLongitude: 101.415, usedLatitude: 2.75,
      usedLongitude: 101.35, distanceKm: 8.42, moved: true, method: 'nearest_marine_grid' } };
}
const renderBeach = () => renderToStaticMarkup(<StaticRouter location={'/beach/' + state.beachId}><CoastalBeachScreen /></StaticRouter>);

beforeEach(() => {
  state.effects = []; state.modelState = null; state.beachId = 'kelanang'; state.lat = 2.789; state.lng = 101.415;
  state.model.mockReset().mockResolvedValue(modelResult());
});

describe('production beach species integration', () => {
  it('targets the beach component selected by the actual app route', () => {
    expect(appSource).toContain("const BeachScreen = lazy(() => import('./screens/CoastalBeachScreen'));");
    expect(appSource).toContain('<Route path="/beach/:beachId" element={<BeachScreen />}');
    expect(renderBeach()).toContain('Modelled Nearby Marine Species');
  });

  it('loads five nearby recommendations on the production beach and preserves its existing sections', async () => {
    const loading = renderBeach();
    expect(loading).toContain('Loading nearby marine species');
    state.effects[0]();
    await Promise.resolve(); await Promise.resolve();
    expect(state.model).toHaveBeenCalledWith(2.789, 101.415, { mode: 'nearby_marine', topK: 5 });
    const html = renderBeach();
    expect(html.match(/data-species-card=/g)).toHaveLength(5);
    expect(html).toContain('More species (40)');
    expect(html).toContain('Scientific species 39');
    expect(html).toContain('A species from the upgraded package.');
    expect(html).toContain('8.4 km from the beach');
    expect(html).toContain('Marine Life &amp; Habitat');
    expect(html).toContain('Approved Conservation Species Cards');
  });

  it('skips the model when the production beach has unknown coordinates', () => {
    state.lat = null; state.lng = null;
    const html = renderBeach();
    state.effects[0]();
    expect(state.model).not.toHaveBeenCalled();
    expect(html).toContain("coordinates are verified");
    expect(html).not.toContain('data-species-card');
  });

  it('ignores an in-flight prediction after leaving the beach', async () => {
    let complete!: (value: unknown) => void;
    state.model.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    renderBeach();
    const cleanup = state.effects[0]();
    expect(state.modelState.loading).toBe(true);
    if (cleanup) cleanup();
    complete(modelResult());
    await Promise.resolve(); await Promise.resolve();
    expect(state.modelState.result).toBeNull();
  });

  it('does not display another beach prediction while a new route is loading', () => {
    state.modelState = { beachId: 'morib', lat: state.lat, lng: state.lng, result: modelResult(), loading: false, error: null };
    const html = renderBeach();
    expect(html).toContain('Loading nearby marine species');
    expect(html).not.toContain('data-species-card');
  });
});
