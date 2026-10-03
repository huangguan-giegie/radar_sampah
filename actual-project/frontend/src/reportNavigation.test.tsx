import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  actions: new Map<string, () => unknown>(),
  navigate: vi.fn(),
  patchDraft: vi.fn(),
  setLastSavedReport: vi.fn(),
  bumpReports: vi.fn(),
  createReport: vi.fn(),
  resolveBeach: vi.fn(),
  geoSuccess: null as null | ((position: GeolocationPosition) => unknown),
}));

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => { testState.effects.push(effect); },
}));
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useNavigate: () => testState.navigate,
  useLocation: () => ({ state: { from: 'details' } }),
  useSearchParams: () => [new URLSearchParams('next=/report/photo')],
}));
vi.mock('./AppContext', () => ({
  useApp: () => ({
    draft: {
      photo: { photoKey: 'photo-1', previewUrl: 'photo.jpg', metadataStripped: true },
      existingPhotoKey: null, existingPhotoUrl: null, editingReportId: null,
      beachId: 'morib', beachName: 'Pantai Morib', locationSource: 'manual',
      coords: null, quantities: { Plastic: 'Large' }, aiDecision: 'manual',
    },
    user: { participantId: '1234' },
    patchDraft: testState.patchDraft,
    setLastSavedReport: testState.setLastSavedReport,
    bumpReports: testState.bumpReports,
    showToast: vi.fn(), createId: vi.fn(), restore: vi.fn(),
  }),
}));
vi.mock('./api', () => ({
  createReport: (...args: unknown[]) => testState.createReport(...args),
  updateReport: vi.fn(), getBeaches: async () => [], getMyReports: async () => [],
  photoPreviewUrl: () => null,
  resolveBeach: (...args: unknown[]) => testState.resolveBeach(...args),
}));
vi.mock('./iteration2Api', () => ({ linkEventReportData: vi.fn() }));
vi.mock('./components/MiniMap', () => ({ MiniMap: () => null }));
vi.mock('./components/ui', async (original) => {
  const actual = await original<typeof import('./components/ui')>();
  function capture(name: string, action?: () => unknown) {
    if (action) testState.actions.set(name, action);
  }
  return {
    ...actual,
    BackButton: ({ onClick }: { onClick: () => void }) => { capture('Back', onClick); return null; },
    PrimaryButton: ({ children, onClick }: { children: ReactNode; onClick?: () => unknown }) => {
      const text = renderToStaticMarkup(<>{children}</>).replace(/<[^>]+>/g, '');
      capture(text, onClick);
      return null;
    },
    GhostButton: ({ children, onClick }: { children: ReactNode; onClick?: () => unknown }) => {
      capture(String(children), onClick);
      return null;
    },
  };
});

import IdentityScreen from './screens/IdentityScreen';
import GpsScreen from './screens/GpsScreen';
import ReviewScreen from './screens/ReviewScreen';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

// SSR captures screen handlers without a DOM. Run their mount/cleanup effects
// explicitly to exercise delayed browser/API callbacks after a route has left.
function mountEffects() {
  const cleanups = testState.effects.map((effect) => effect());
  return () => cleanups.forEach((cleanup) => cleanup?.());
}

beforeEach(() => {
  vi.clearAllMocks();
  testState.effects = [];
  testState.actions.clear();
  testState.geoSuccess = null;
  vi.stubGlobal('window', { history: { state: { idx: 0 } } });
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: (position: GeolocationPosition) => unknown) => {
        testState.geoSuccess = success;
      },
    },
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('report navigation regression cases', () => {
  it('leaves a directly opened identity page instead of returning to its protected next route', () => {
    renderToStaticMarkup(<IdentityScreen />);
    testState.actions.get('Back')?.();
    expect(testState.navigate).toHaveBeenCalledWith('/home', { replace: true });
  });

  it('ignores GPS after the user has already chosen a beach manually', async () => {
    renderToStaticMarkup(<GpsScreen />);
    mountEffects();
    testState.actions.get('Allow Once')?.();
    testState.actions.get('Choose Beach Manually')?.();
    await testState.geoSuccess?.({ coords: { latitude: 2.7, longitude: 101.4, accuracy: 20 } } as GeolocationPosition);
    expect(testState.patchDraft).toHaveBeenCalledTimes(1);
    expect(testState.patchDraft).toHaveBeenCalledWith({ locationSource: 'manual', gpsIssue: null, coords: null });
    expect(testState.resolveBeach).not.toHaveBeenCalled();
    expect(testState.navigate).toHaveBeenCalledTimes(1);
  });

  it('ignores a pending beach lookup after leaving the location page', async () => {
    const pending = deferred<unknown>();
    testState.resolveBeach.mockReturnValue(pending.promise);
    renderToStaticMarkup(<GpsScreen />);
    const leave = mountEffects();
    testState.actions.get('Allow Once')?.();
    const lookup = testState.geoSuccess?.({ coords: { latitude: 2.7, longitude: 101.4, accuracy: 20 } } as GeolocationPosition);
    leave();
    pending.resolve({ id: 'morib', name: 'Pantai Morib' });
    await lookup;
    expect(testState.patchDraft).not.toHaveBeenCalled();
    expect(testState.navigate).not.toHaveBeenCalled();
  });

  it('submits once and does not redirect or clear a later draft after browser Back', async () => {
    const pending = deferred<unknown>();
    testState.createReport.mockReturnValue(pending.promise);
    renderToStaticMarkup(<ReviewScreen />);
    const leave = mountEffects();
    const save = testState.actions.get('Submit Report');
    const result = save?.();
    await save?.();
    expect(testState.createReport).toHaveBeenCalledTimes(1);
    leave();
    pending.resolve({ id: 'saved-1', beachId: 'morib', status: 'Counted' });
    await result;
    expect(testState.bumpReports).toHaveBeenCalledTimes(1);
    expect(testState.setLastSavedReport).not.toHaveBeenCalled();
    expect(testState.navigate).not.toHaveBeenCalled();
  });
});
