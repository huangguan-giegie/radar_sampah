import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ cleanupLoading: false, cleanupCount: 0 }));

vi.mock('./iteration2Api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./iteration2Api')>(),
  fetchCleanupEvent: async () => ({
    id: 'event-1', beachId: 'morib', beachName: 'Pantai Morib', area: 'Selangor coast',
    date: '2026-10-03', startsAt: '2026-10-03T08:00:00+08:00', endsAt: '2026-10-03T10:00:00+08:00',
    status: 'Open', participantCount: 2, attendanceCount: 1, meetingPoint: null,
  }),
  fetchEventCleanups: async () => Array.from({ length: state.cleanupCount }, (_, i) => ({ id: String(i) })),
}));
vi.mock('./api', async (importOriginal) => ({ ...await importOriginal<typeof import('./api')>(), USE_MOCK: true }));
vi.mock('./useAsyncData', async () => ({
  useAsyncData: (_load: unknown, _deps: unknown, initial: unknown) => ({
    data: Array.isArray(initial) ? Array.from({ length: state.cleanupCount }, (_, i) => ({ id: String(i) })) : initial ?? {
      id: 'event-1', beachId: 'morib', beachName: 'Pantai Morib', area: 'Selangor coast',
      date: '2026-10-03', startsAt: '2026-10-03T08:00:00+08:00', endsAt: '2026-10-03T10:00:00+08:00',
      status: 'Open', participantCount: 2, attendanceCount: 1, meetingPoint: null,
    },
    loading: Array.isArray(initial) && state.cleanupLoading,
    error: null,
    setData: vi.fn(),
    refresh: vi.fn(),
  }),
}));
vi.mock('./AppContext', () => ({ useApp: () => ({ user: null, showToast: vi.fn(), reportsVersion: 0 }) }));

import EventScreen from './screens/EventScreen';

function renderEvent() {
  return renderToStaticMarkup(<MemoryRouter initialEntries={['/events/event-1']}><EventScreen /></MemoryRouter>);
}

beforeEach(() => { state.cleanupLoading = false; state.cleanupCount = 0; });

describe('event detail accuracy', () => {
  it('does not invent a meeting point or present the beach area as one', () => {
    const markup = renderEvent();
    expect(markup).toContain('<strong>Meeting point:</strong> To be confirmed by the organiser.');
    expect(markup).not.toContain('<strong>Meeting point:</strong> Selangor coast');
  });

  it('labels the count as event records and waits for the request before showing zero', () => {
    state.cleanupLoading = true;
    const loading = renderEvent();
    expect(loading).toContain('Loading event records');
    expect(loading).not.toContain('0 recorded cleanups for this event');
    state.cleanupLoading = false;
    state.cleanupCount = 2;
    expect(renderEvent()).toContain('2 recorded cleanups for this event');
  });
});
