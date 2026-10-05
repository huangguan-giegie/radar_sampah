import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  beach: { id: 'expanded', name: 'Expanded Beach', area: 'Malaysia', lat: null as number | null, lng: null as number | null,
    severity: null, insufficientData: true, validReports: 0 },
  coords: null as { lat: number; lng: number } | null,
  source: 'manual',
  model: vi.fn(async (..._coordinates: unknown[]) => ({ predictions: [] })),
  patch: vi.fn(),
}));
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect); },
  useState: <T,>(value: T) => [Array.isArray(value) ? [state.beach] : value === true ? false : value, vi.fn()],
}));
vi.mock('./AppContext', () => ({ useApp: () => ({
  user: null, draft: { beachId: 'expanded', locationSource: state.source, coords: state.coords },
  patchDraft: state.patch, resetDraft: vi.fn(), setLastSavedReport: vi.fn(),
}) }));
vi.mock('./api', () => ({
  USE_MOCK: false, getBeaches: async () => [state.beach], getBeach: async () => state.beach,
  getSpeciesDistribution: (...args: unknown[]) => state.model(...args),
}));
vi.mock('./useAsyncData', () => ({ useAsyncData: () => ({ data: null, loading: false, error: null, refresh: vi.fn() }) }));
vi.mock('./components/MiniMap', () => ({ MiniMap: ({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) =>
  <div data-map-lat={lat} data-map-lng={lng} data-map-zoom={zoom} />,
}));

import ConfirmBeachScreen from './screens/ConfirmBeachScreen';
import BeachScreen from './screens/BeachScreen';

beforeEach(() => {
  state.effects = []; state.beach.lat = null; state.beach.lng = null;
  state.coords = null; state.source = 'manual'; state.model.mockClear(); state.patch.mockClear();
});
describe('beaches without verified coordinates', () => {
  it('keeps manual selection available and uses a broad viewport instead of null coordinates', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ConfirmBeachScreen /></MemoryRouter>);
    expect(html).toContain('Expanded Beach');
    expect(html).toContain('Choose your beach');
    expect(html).toContain('data-map-lat="4.05"');
    expect(html).toContain('data-map-lng="109.5"');
    expect(html).toContain('data-map-zoom="4"');
    expect(state.patch).not.toHaveBeenCalled();
    expect(state.beach.lat).toBeNull();
  });
  it('does not present a beach with unknown coordinates as a GPS suggestion', () => {
    state.source = 'gps';
    const html = renderToStaticMarkup(<MemoryRouter><ConfirmBeachScreen /></MemoryRouter>);
    expect(html).toContain('MANUAL BEACH SELECTION');
    expect(html).not.toContain('SUGGESTED FROM YOUR LOCATION');
  });
  it('preserves a verified GPS position and the existing close view', () => {
    state.source = 'gps'; state.coords = { lat: 2.747, lng: 101.44 };
    state.beach.lat = 2.746; state.beach.lng = 101.44;
    const html = renderToStaticMarkup(<MemoryRouter><ConfirmBeachScreen /></MemoryRouter>);
    expect(html).toContain('data-map-lat="2.747"');
    expect(html).toContain('data-map-zoom="12"');
    expect(html).toContain('SUGGESTED FROM YOUR LOCATION');
  });
  it('skips biodiversity prediction when the beach coordinate is unknown', async () => {
    renderToStaticMarkup(<MemoryRouter><BeachScreen /></MemoryRouter>);
    state.effects[0]();
    await Promise.resolve(); await Promise.resolve();
    expect(state.model).not.toHaveBeenCalled();
  });
  it('still requests biodiversity prediction for a beach with verified coordinates', async () => {
    state.beach.lat = 2.746; state.beach.lng = 101.44;
    renderToStaticMarkup(<MemoryRouter><BeachScreen /></MemoryRouter>);
    state.effects[0]();
    await Promise.resolve(); await Promise.resolve();
    expect(state.model).toHaveBeenCalledWith(2.746, 101.44);
  });
});
