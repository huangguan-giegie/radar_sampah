import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ api: vi.fn(), data: null as any }));
vi.mock('./api', () => ({ USE_MOCK: false, apiRequest: (...args: unknown[]) => state.api(...args) }));
vi.mock('./AppContext', () => ({ useApp: () => ({ user: null, reportsVersion: 1 }) }));
vi.mock('./iteration3Api', () => ({ iteration3Request: vi.fn(async () => null) }));
vi.mock('./coastalData', () => ({ getCoastalBeaches: vi.fn(async () => []) }));
vi.mock('./useAsyncData', () => ({
  useAsyncData: (load: () => Promise<unknown>, _dependencies: unknown, initial: unknown) => {
    void load();
    return { data: load.toString().includes('fetchInsights') ? state.data : Array.isArray(initial) ? [] : null, loading: false, error: null, refresh: vi.fn() };
  },
}));

import InsightsScreen from './screens/InsightsScreen';

function render(location: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[location]}><Routes>
    <Route path="/insights/:topic?" element={<InsightsScreen />} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  state.api.mockReset();
  state.api.mockResolvedValue({});
  state.data = {
    asOf: '2026-10-05T00:00:00Z', windowDays: 90, comparisonAt: '2026-09-05T00:00:00Z',
    comparisonBasis: 'Earlier bands are reconstructed from saved reports and dated cleanup records.',
    overview: { reports: 2, cleanups: 1, joined: 0, needHelp: 0, registeredBeaches: 1, beachesWithReports: 0, beachesWithBand: 0 },
    trendSummary: { changed: 0, movedUp: 0, movedDown: 0, noBand: 1, comparable: 0 },
    beaches: [{ id: 'morib', name: 'Pantai Morib', area: 'Selangor', photo: null, from: null, to: null, reports: 2, activeReports: 0,
      reportsLast30Days: 0, reportsPrevious30Days: 1, attentionScore: null, needsHelp: false, monthlyReports: [], composition: [], habitat: '', speciesNames: [] }],
    cleanup: { total: 1, evaluatedCleanups: 0, remaining: [], handling: [['Not recorded', 100]], history: [{ id: 'clean-1', beachId: 'morib', beachName: 'Pantai Morib', targetReportId: null, eventId: null, createdAt: '2026-10-04', handling: 'Not recorded', rows: [{ category: 'Plastic', removedBand: 'Medium' }], linked: false, nextReportedAt: null, daysUntilNextReport: null, daysSinceCleanup: 1 }] },
    participation: { all: [0, 0, 0], morib: [0, 0, 0] }, participationBasis: 'Person-event records.', wildlife: [],
  };
});

describe('production Insights scope and count labels', () => {
  it('requests cleanup aggregates and records for the selected beach', () => {
    render('/insights/cleanup?beach=morib');
    expect(state.api).toHaveBeenCalledWith('/insights?beachId=morib');
  });

  it('lists all 179 Wildlife beaches even when published species are missing', () => {
    state.data.wildlife = Array.from({ length: 179 }, (_, index) => ({
      beachId: 'beach-' + index,
      name: 'Coastal Beach ' + index,
      habitat: 'Coastal environment',
      species: index < 101 ? ['Published species ' + index] : [],
      activeReports: 0,
      composition: [],
    }));
    const markup = render('/insights/wildlife');
    expect(markup).toContain('179');
    expect(markup).toContain('101 with published references');
    expect(markup).toContain('Coastal Beach 178');
    expect(markup).toContain('No species suggestion available');
  });

  it('labels cleanup history and active scoring windows separately', () => {
    const markup = render('/insights/cleanup?beach=morib');
    expect(markup).toContain('Cleanup records · last 90 days');
    expect(markup).toContain('Active reports · latest 90 days');
    expect(markup).toContain('not litter-item counts');
  });
  it('distinguishes missing follow-up, a same-day report and a one-day report', () => {
    expect(render('/insights/cleanup')).toContain('1 day since cleanup');
    const cleanup = state.data.cleanup.history[0];
    cleanup.nextReportedAt = '2026-10-04T15:00:00Z';
    cleanup.daysUntilNextReport = 0;
    expect(render('/insights/cleanup')).toContain('Next report the same day');
    cleanup.daysUntilNextReport = 1;
    expect(render('/insights/cleanup')).toContain('Next report after 1 day');
    expect(render('/insights/cleanup')).not.toContain('1 days');
  });
});
