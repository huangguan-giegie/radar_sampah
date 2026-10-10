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

describe('planned cleanup remains usable without the removed context card', () => {
  it('keeps an existing Low-attention activity available', () => {
    const html = renderEvent();
    expect(html).not.toContain('BEACH CONTEXT');
    expect(html).not.toContain('Weekly cleanups are scheduled');
    expect(html).toContain('Join This Cleanup');
  });
  it('does not hide an existing activity when current beach data is insufficient', () => {
    state.severity = null; state.insufficientData = true; state.validReports = 0;
    expect(renderEvent()).toContain('Join This Cleanup');
  });
  it('keeps moderator activities available too', () => {
    state.source = 'admin';
    expect(renderEvent()).toContain('Join This Cleanup');
  });
  it('keeps the invitation usable through a beach-data loading or failure state', () => {
    state.loading = true;
    expect(renderEvent()).toContain('Share Event Invitation');
    state.loading = false; state.error = 'Offline';
    expect(renderEvent()).toContain('Join This Cleanup');
    expect(renderEvent()).not.toContain('Current Beach Attention:');
  });
});
