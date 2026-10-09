import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ call: 0 }));
vi.mock('react-router-dom', async original => ({
  ...await original<typeof import('react-router-dom')>(),
  useLocation: () => ({ pathname: '/community/needs-volunteers', search: '' }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock('./AppContext', () => ({ useApp: () => ({ user: null, reportsVersion: 1 }) }));
vi.mock('./api', () => ({ USE_MOCK: false, getBeaches: vi.fn() }));
vi.mock('./iteration2Api', () => ({ fetchCleanupEvents: vi.fn(), fetchLatestCleanupDates: vi.fn() }));
vi.mock('./eventAvailability', () => ({ useEventClock: () => Date.parse('2026-10-09T00:00:00Z'), eventIsAvailable: () => true, eventPhase: () => 'upcoming' }));
vi.mock('./useAsyncData', () => ({
  useAsyncData: () => {
    const call = state.call++;
    const common = { loading: false, error: null, refresh: vi.fn() };
    if (call === 0) return { ...common, data: [{ id: 'ev-1', beachId: 'event', beachName: 'Pantai Event', area: 'Perak', date: '2026-10-12', startsAt: '2026-10-12T09:00:00Z', endsAt: '2026-10-12T12:00:00Z', status: 'Open', source: 'admin', participantCount: 1, attendanceCount: 0, joinedBy: [], checkIns: {}, attendanceBy: [], evidenceBy: [], reportEvidenceBy: {}, cleanupIds: [] }] };
    if (call === 1) return { ...common, data: [
      { id: 'severe', name: 'Pantai Severe', area: 'Selangor', severity: 'Severe', insufficientData: false, validReports: 4, lastReportedAt: '2026-10-08T00:00:00Z', lat: 2, lng: 101 },
      { id: 'event', name: 'Pantai Event', area: 'Perak', severity: 'Moderate', insufficientData: false, validReports: 3, lastReportedAt: '2026-10-07T00:00:00Z', lat: 3, lng: 102 },
    ] };
    return { ...common, data: { severe: null, event: null } };
  },
}));

import CommunityScreen from './screens/CommunityScreen';

describe('beaches needing help ordering', () => {
  it('ranks no-event beaches and scheduled cleanups in one priority order and explains each reason', () => {
    state.call = 0;
    const markup = renderToStaticMarkup(<CommunityScreen />);
    expect(markup.indexOf('Pantai Severe')).toBeLessThan(markup.indexOf('Pantai Event'));
    expect(markup).toContain('No cleanup recorded in the last 30 days');
    expect(markup).toContain('Low sign-up for the next event');
    expect(markup).toContain('Latest counted report');
  });
});
