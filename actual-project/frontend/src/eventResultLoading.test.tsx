import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ loading: false, error: null as string | null }));
const event = {
  id: 'event-1', beachId: 'morib', beachName: 'Pantai Morib', date: '2026-10-03',
  startsAt: '2026-10-03T08:00:00+08:00', endsAt: '2026-10-03T10:00:00+08:00',
  status: 'Open', participantCount: 2, attendanceCount: 1,
};

vi.mock('./iteration2', async (importOriginal) => ({
  ...await importOriginal<typeof import('./iteration2')>(),
  getCleanupEvent: () => null,
  eventCleanups: () => [],
}));
vi.mock('./useAsyncData', () => ({
  useAsyncData: (_load: unknown, _dependencies: unknown, initial: unknown) => Array.isArray(initial)
    ? { data: [], loading: state.loading, error: state.error }
    : { data: event, loading: false, error: null },
}));

import EventResultScreen from './screens/EventResultScreen';

function renderResult() {
  return renderToStaticMarkup(<MemoryRouter><EventResultScreen /></MemoryRouter>);
}

beforeEach(() => { state.loading = false; state.error = null; });

describe('event cleanup evidence loading', () => {
  it('does not claim there were no cleanups before the request completes', () => {
    state.loading = true;
    const html = renderResult();
    expect(html).toContain('Loading cleanup results');
    expect(html).not.toContain('No cleanup result yet');
    expect(html).not.toContain('<strong>0</strong>');
  });

  it('shows a failed request instead of publishing a zero cleanup score', () => {
    state.error = 'The server is unavailable';
    const html = renderResult();
    expect(html).toContain('Could not load cleanup results');
    expect(html).toContain('The server is unavailable');
    expect(html).not.toContain('No cleanup result yet');
    expect(html).not.toContain('<strong>0</strong>');
  });

  it('shows an empty result only after a successful empty response', () => {
    const html = renderResult();
    expect(html).toContain('No cleanup result yet');
    expect(html).toContain('<strong>0</strong>');
  });
});
