import appSource from './App.tsx?raw';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', async original => ({
  ...await original<typeof import('react-router-dom')>(),
  useParams: () => ({ beachId: 'kelanang' }),
}));
vi.mock('./api', () => ({ USE_MOCK: false, getBeach: vi.fn() }));
vi.mock('./AppContext', () => ({
  useApp: () => ({
    user: null,
    draft: {},
    resetDraft: vi.fn(),
    patchDraft: vi.fn(),
    setLastSavedReport: vi.fn(),
    reportsVersion: 1,
  }),
}));
vi.mock('./navigation', () => ({ useAppBack: () => vi.fn() }));
vi.mock('./eventAvailability', () => ({ useEventClock: () => Date.now(), eventIsAvailable: () => false }));
vi.mock('./useAsyncData', () => ({
  useAsyncData: (_load: unknown, _dependencies: unknown, initial: unknown) => ({
    data: Array.isArray(initial) ? [] : {
      id: 'kelanang',
      name: 'Pantai Kelanang',
      area: 'Selangor',
      lat: 2.789,
      lng: 101.415,
      severity: null,
      insufficientData: true,
      validReports: 0,
      scene: '#edf2f8',
      habitat: 'Coastal habitat',
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

import CoastalBeachScreen from './screens/CoastalBeachScreen';

const renderBeach = () => renderToStaticMarkup(
  <StaticRouter location="/beach/kelanang"><CoastalBeachScreen /></StaticRouter>,
);

describe('teammate frontend v2 beach integration', () => {
  it('keeps the production beach route on the teammate v2 beach screen', () => {
    expect(appSource).toContain("const BeachScreen = lazy(() => import('./screens/CoastalBeachScreen'));");
    expect(appSource).toContain('<Route path="/beach/:beachId" element={<BeachScreen />}');
    const html = renderBeach();
    expect(html).toContain('Marine Life &amp; Habitat');
    expect(html).toContain('Species Guide');
  });

  it('keeps the teammate v2 beach action tiles', () => {
    const html = renderBeach();
    expect(html).toContain('What You Can Do Here');
    expect(html).toContain('Report Litter');
    expect(html).toContain('Join Cleanup');
    expect(html).toContain('Log Cleanup');
  });

  it('uses the verified v2 species media on the beach page', () => {
    const html = renderBeach();
    expect(html).toContain('/images/coastal/thalassina-kelanang.jpg');
    expect(html).toContain('Thalassina kelanang');
    expect(html).not.toContain('Modelled Nearby Marine Species');
  });
});
