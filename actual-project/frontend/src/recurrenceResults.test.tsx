import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CleanupAction } from './iteration2';

const state = vi.hoisted(() => ({ mode: 'event', cleanups: [] as CleanupAction[] }));
vi.mock('./iteration2', async (original) => ({
  ...await original<typeof import('./iteration2')>(),
  getCleanupEvent: () => null,
  eventCleanups: () => [],
}));
vi.mock('./useAsyncData', () => ({
  useAsyncData: (_load: unknown, _dependencies: unknown, initial: unknown) => ({
    data: Array.isArray(initial) ? state.cleanups : state.mode === 'cleanup' ? state.cleanups[0] : {
      id: 'event-1', beachId: 'morib', beachName: 'Pantai Morib', date: '2026-10-03',
      startsAt: '08:00', endsAt: '10:00', status: 'Closed', participantCount: 3, attendanceCount: 3,
    },
    loading: false, error: null,
  }),
}));
import EventResultScreen from './screens/EventResultScreen';
import CleanupResultScreen from './screens/CleanupResultScreen';

function cleanup(id: string, createdAt: string, status: string): CleanupAction {
  return {
    id, createdAt, participantId: '1234', targetReportId: 'report-1', eventId: 'event-1',
    beachId: 'morib', beachName: 'Pantai Morib', rows: [], score: 1, handling: 'Not recorded', note: '',
    status, recurrence: { cleanupAt: createdAt, cleanupDate: '2026-10-03', intervalDays: null,
      daysSinceCleanup: 2, status, calloutStatus: status },
  };
}

beforeEach(() => { state.mode = 'event'; state.cleanups = []; });
describe('recurrence on result pages', () => {
  it('shows the event latest cleanup follow-up state, independent of response order', () => {
    state.cleanups = [
      cleanup('later', '2026-10-03T10:00:00+08:00', 'No follow-up report yet'),
      cleanup('earlier', '2026-10-03T01:00:00Z', 'No follow-up report before the next cleanup'),
    ];
    const html = renderToStaticMarkup(<MemoryRouter><EventResultScreen /></MemoryRouter>);
    expect(html).toContain('No follow-up report yet');
    expect(html).not.toContain('No follow-up report before the next cleanup');
  });
  it('shows an individual cleanup own interval and preserves resolved source history wording', () => {
    state.mode = 'cleanup';
    const own = cleanup('own', '2026-10-03T10:00:00+08:00', 'No follow-up report before the next cleanup');
    own.resolved = true;
    state.cleanups = [own];
    const html = renderToStaticMarkup(<MemoryRouter><CleanupResultScreen /></MemoryRouter>);
    expect(html).toContain('No follow-up report before the next cleanup');
    expect(html).toContain('Resolved — source report kept in history');
  });
});
