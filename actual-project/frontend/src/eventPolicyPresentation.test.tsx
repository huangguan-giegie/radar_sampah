import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  severity: 'Low' as string | null, validReports: 3, insufficientData: false,
  loading: false, error: null as string | null, source: 'weekly',
}));

vi.mock('./AppContext', () => ({ useApp: () => ({ user: null, reportsVersion: 1, showToast: vi.fn() }) }));
vi.mock('./iteration2', async original => ({
  ...await original<typeof import('./iteration2')>(),
  getCleanupEvent: () => null,
}));
vi.mock('./useAsyncData', () => ({
  useAsyncData: (_load: unknown, dependencies: unknown[], initial: unknown) => ({
    data: Array.isArray(initial) ? [] : dependencies[1] === 1
      ? state.error || state.loading ? null : { severity: state.severity, insufficientData: state.insufficientData, validReports: state.validReports }
      : { id: 'morib-2026-10-10', beachId: 'morib', beachName: 'Pantai Morib', area: 'Selangor',
          date: '2026-10-10', startsAt: '09:00', endsAt: '12:00', source: state.source,
          status: 'Open', participantCount: 2, attendanceCount: 0 },
    loading: dependencies[1] === 1 && state.loading,
    error: dependencies[1] === 1 ? state.error : null,
    setData: vi.fn(), refresh: vi.fn(),
  }),
}));
vi.mock('./eventAvailability', async original => ({
  ...await original<typeof import('./eventAvailability')>(),
  useEventClock: () => Date.parse('2026-10-06T09:00:00+08:00'),
}));

import EventScreen from './screens/EventScreen';

const renderEvent = () => renderToStaticMarkup(<StaticRouter location="/events/morib-2026-10-10"><EventScreen /></StaticRouter>);

beforeEach(() => {
  state.severity = 'Low'; state.validReports = 3; state.insufficientData = false;
  state.loading = false; state.error = null; state.source = 'weekly';
});

describe('planned cleanup and current beach context', () => {
  it('shows the current Low band and keeps the planned activity available', () => {
    const html = renderEvent();
    expect(html).toContain('Current Beach Attention: <strong>Low</strong>');
    expect(html).toContain('already planned activities and registrations remain');
    expect(html).toContain('Join This Cleanup');
  });

  it('shows insufficient data and explains that it pauses new automatic scheduling', () => {
    state.severity = null; state.insufficientData = true; state.validReports = 0;
    const html = renderEvent();
    expect(html).toContain('Current Beach Attention: <strong>Insufficient data</strong>');
    expect(html).toContain('Low or insufficient data pauses new scheduling');
  });

  it('does not apply the weekly eligibility explanation to a moderator activity', () => {
    state.source = 'admin';
    const html = renderEvent();
    expect(html).toContain('Current Beach Attention');
    expect(html).not.toContain('Weekly cleanups are scheduled');
  });

  it('keeps beach context loading and failure distinct from an insufficient-data band', () => {
    state.loading = true;
    expect(renderEvent()).toContain('Loading current Beach Attention');
    state.loading = false; state.error = 'Offline';
    const html = renderEvent();
    expect(html).toContain('Current Beach Attention could not be loaded');
    expect(html).toContain('Retry beach data');
    expect(html).not.toContain('Current Beach Attention:');
  });
});
