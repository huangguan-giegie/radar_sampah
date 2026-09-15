import { describe, expect, it } from 'vitest';
import type { ReportDraft } from './AppContext';
import {
  CAME_FROM_DETAILS,
  backFromReview,
  buildReportSubmission,
  findExactDuplicateReport,
  finishReportSubmission,
  formatReportComposition,
  guardStep,
  hasDraftProgress,
  historicalPhotoUnavailable,
  orderByNeed,
  quantityBandForCount,
  quantityBandsForCounts,
  reachableStep,
  reportOutcome,
  safeNextPath,
} from './flowRules';
import { markerHtml } from './components/BeachMarker';
import type { BeachSummary } from './types';
import { attentionStateFor, formatDate } from './theme';

describe('fixed date presentation', () => {
  it('uses the exact date and weekday while preserving an unambiguous order', () => {
    // Keep this safely away from the CI clock so it cannot become "Today".
    expect(formatDate('2030-09-18T04:00:00+08:00')).toBe('2030-09-18 (Wed)');
  });
});

function draft(changes: Partial<ReportDraft> = {}): ReportDraft {
  return {
    photo: { photoKey: 'mock/test.jpg', previewUrl: 'blob:test', metadataStripped: true },
    existingPhotoUrl: null,
    existingPhotoKey: null,
    existingPhotoUnavailable: false,
    beachId: 'morib',
    beachName: 'Pantai Morib',
    locationSource: 'manual',
    coords: null,
    quantities: { Plastic: 'Small' },
    itemCounts: null,
    eventId: null,
    aiDecision: 'manual',
    aiModelState: null,
    aiModelVersion: null,
    gpsIssue: null,
    editingReportId: null,
    editingStatus: null,
    editingStatusNote: null,
    ...changes,
  };
}

describe('legacy detector-count compatibility rules', () => {
  it.each([
    [1, 'Small'], [5, 'Small'], [6, 'Medium'], [20, 'Medium'],
    [21, 'Large'], [50, 'Large'], [51, 'Very Large'],
  ] as const)('derives the internal band for %s detector items', (count, band) => {
    expect(quantityBandForCount(count)).toBe(band);
  });

  it('derives bands only for positive whole detector counts', () => {
    expect(quantityBandsForCounts({ Plastic: 8, Other: 2, Glass: 0, Metal: 2.8 }))
      .toEqual({ Plastic: 'Medium', Other: 'Small' });
  });

  it('runs AI before category and band confirmation', () => {
    const beforeAi = draft({ quantities: {}, itemCounts: null, aiDecision: null, aiModelState: null });
    expect(reachableStep(beforeAi)).toBe('suggestions');

    const afterEmptyAi = draft({ quantities: {}, itemCounts: {}, aiDecision: null, aiModelState: 'empty' });
    expect(reachableStep(afterEmptyAi)).toBe('details');
    expect(guardStep('review', afterEmptyAi)).toBe('/report/details');
  });

  it('can restore a legacy count-only draft by deriving bands', () => {
    const result = buildReportSubmission(draft({
      quantities: {},
      itemCounts: { Plastic: 8, Other: 2 },
      aiDecision: 'confirmed',
      aiModelState: 'ready',
    }));
    expect(result.kind).toBe('create');
    if (result.kind === 'create') {
      expect(result.payload.itemCounts).toEqual({ Plastic: 8, Other: 2 });
      expect(result.payload.quantities).toEqual({ Plastic: 'Medium', Other: 'Small' });
    }
  });
});

describe('attentionStateFor', () => {
  it.each([0, 1, 2])('keeps %s active reports in a neutral insufficient-data state', (validReports) => {
    const reportWord = validReports === 1 ? 'report' : 'reports';
    expect(attentionStateFor(null, true, validReports)).toEqual({
      markerLabel: 'NO DATA',
      pageLabel: 'Insufficient data',
      detail: `${validReports} active ${reportWord} · At least 3 active reports are required for a band`,
      hasBand: false,
    });
  });

  it('shows the severity label once the beach has enough active reports', () => {
    expect(attentionStateFor('High', false, 3)).toEqual({
      markerLabel: 'HIGH',
      pageLabel: 'High',
      detail: null,
      hasBand: true,
    });
  });

  it('does not trust a band when the count is below the minimum', () => {
    expect(attentionStateFor('High', false, 1).hasBand).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('keeps valid internal paths', () => {
    expect(safeNextPath('/report/photo?from=home')).toBe('/report/photo?from=home');
  });

  it.each([null, '', 'https://example.com', '//example.com', '/\\example.com'])(
    'rejects an unsafe redirect: %s',
    (value) => expect(safeNextPath(value)).toBe('/home'),
  );
});

describe('findExactDuplicateReport', () => {
  const existing = {
    id: 'R-2041',
    beachId: 'morib',
    beachName: 'Pantai Morib',
    quantities: { Plastic: 'Small' as const, Glass: 'Medium' as const },
    category: 'Glass' as const,
    quantity: 'Medium' as const,
    categoryScores: {},
    reportScore: 1,
    createdAt: '2026-09-10T03:00:00.000Z',
    status: 'Counted' as const,
  };

  it('finds a same-day exact match regardless of category key order', () => {
    expect(findExactDuplicateReport(
      draft({ quantities: { Glass: 'Medium', Plastic: 'Small' } }),
      [existing],
      new Date('2026-09-10T12:00:00+08:00'),
    )?.id).toBe('R-2041');
  });

  it('does not warn when one confirmed quantity differs', () => {
    expect(findExactDuplicateReport(
      draft({ quantities: { Glass: 'Large', Plastic: 'Small' } }),
      [existing],
      new Date('2026-09-10T12:00:00+08:00'),
    )).toBeNull();
  });
});

describe('buildReportSubmission', () => {
  it('refuses unconfirmed AI or manual values', () => {
    expect(() => buildReportSubmission(draft({ aiDecision: null }))).toThrow(/Confirm the AI suggestion/);
  });

  it('includes coordinates only for a GPS report', () => {
    const result = buildReportSubmission(draft({ locationSource: 'gps', coords: { lat: 2.95, lng: 101.42 } }));
    expect(result.kind).toBe('create');
    if (result.kind === 'create') {
      expect(result.payload.locationSource).toBe('gps');
      expect(result.payload.coords).toEqual({ lat: 2.95, lng: 101.42 });
    }
  });

  it('removes stale coordinates from a manual report', () => {
    const result = buildReportSubmission(draft({ locationSource: 'manual', coords: { lat: 2.95, lng: 101.42 } }));
    expect(result.kind).toBe('create');
    if (result.kind === 'create') {
      expect(result.payload.locationSource).toBe('manual');
      expect(result.payload).not.toHaveProperty('coords');
    }
  });

  it('carries every picked category through to the payload', () => {
    const result = buildReportSubmission(draft({ quantities: { Plastic: 'Large', 'Fishing gear': 'Medium', Glass: 'Small' } }));
    expect(result.kind).toBe('create');
    if (result.kind === 'create') {
      expect(result.payload.quantities).toEqual({ Plastic: 'Large', 'Fishing gear': 'Medium', Glass: 'Small' });
    }
  });

  it('treats confirmed bands as canonical even when a legacy count map is present', () => {
    const result = buildReportSubmission(draft({
      quantities: { Plastic: 'Medium', Other: 'Small' },
      itemCounts: { Plastic: 8, Other: 2 },
      aiDecision: 'confirmed',
      aiModelState: 'ready',
    }));
    expect(result.kind).toBe('create');
    if (result.kind === 'create') {
      expect(result.payload.quantities).toEqual({ Plastic: 'Medium', Other: 'Small' });
      expect(result.payload).not.toHaveProperty('itemCounts');
    }
  });

  it('refuses a report with no category at all', () => {
    expect(() => buildReportSubmission(draft({ quantities: {}, itemCounts: null }))).toThrow(/missing a required field/);
  });

  it('refuses a category that was picked but given no quantity band', () => {
    expect(() => buildReportSubmission(draft({ quantities: { Plastic: 'Large', Glass: undefined } }))).toThrow(/Glass/);
  });

  it('keeps every category when only the photo is corrected', () => {
    const result = buildReportSubmission(draft({
      editingReportId: 'report-1',
      quantities: { Plastic: 'Large', 'Fishing gear': 'Medium', Glass: 'Small' },
    }));
    expect(result.kind).toBe('update');
    if (result.kind === 'update') {
      expect(result.changes.quantities).toEqual({ Plastic: 'Large', 'Fishing gear': 'Medium', Glass: 'Small' });
    }
  });

  it('allows an existing report to be corrected without a replacement photo', () => {
    const result = buildReportSubmission(draft({ editingReportId: 'report-1', photo: null, existingPhotoUrl: '/existing.jpg' }));
    expect(result).toEqual({
      kind: 'update',
      reportId: 'report-1',
      changes: { beachId: 'morib', quantities: { Plastic: 'Small' }, locationSource: 'manual' },
    });
  });

  it('reuses the existing photo key when its preview is unavailable', () => {
    const result = buildReportSubmission(draft({
      editingReportId: 'report-1',
      photo: null,
      existingPhotoUrl: null,
      existingPhotoKey: 'seed/r1.jpg',
      existingPhotoUnavailable: true,
    }));
    expect(result).toEqual({
      kind: 'update',
      reportId: 'report-1',
      changes: {
        beachId: 'morib',
        quantities: { Plastic: 'Small' },
        locationSource: 'manual',
        photoKey: 'seed/r1.jpg',
      },
    });
  });

  it('preserves the original GPS source when correcting without new coordinates', () => {
    const result = buildReportSubmission(draft({
      editingReportId: 'report-gps',
      photo: null,
      existingPhotoUrl: '/existing.jpg',
      locationSource: 'gps',
      coords: null,
    }));
    expect(result.kind).toBe('update');
    if (result.kind === 'update') {
      expect(result.changes).not.toHaveProperty('locationSource');
      expect(result.changes).not.toHaveProperty('coords');
    }
  });
});

describe('report composition display', () => {
  it('shows every selected category and quantity in a stable order', () => {
    expect(formatReportComposition({ Glass: 'Small', Plastic: 'Large', 'Fishing gear': 'Medium' }))
      .toBe('Plastic — Large · Fishing gear — Medium · Glass — Small');
  });

  it('returns a neutral value when no category is available', () => {
    expect(formatReportComposition({})).toBe('No categories recorded');
  });

  it('ignores legacy exact counts when confirmed bands are available', () => {
    expect(formatReportComposition(
      { Plastic: 'Medium', Glass: 'Small' },
      { Plastic: 8, Glass: 2 },
    )).toBe('Plastic — Medium · Glass — Small');
  });

  it('keeps confirmed bands when no legacy counts exist', () => {
    expect(formatReportComposition({ Plastic: 'Medium' })).toBe('Plastic — Medium');
  });
});

describe('Historical correction draft photo state', () => {
  it('marks a keyed report without a preview as unavailable on entry', () => {
    expect(historicalPhotoUnavailable(null, 'seed/r1.jpg')).toBe(true);
    expect(historicalPhotoUnavailable('/photo.jpg', 'seed/r1.jpg')).toBe(false);
    expect(historicalPhotoUnavailable(null, null)).toBe(false);
  });
});

describe('reportOutcome', () => {
  it('returns truthful outcomes for every report status', () => {
    expect(reportOutcome('Counted').badge).toContain('COUNTED');
    expect(reportOutcome('Duplicate').badge).toContain('DUPLICATE');
    expect(reportOutcome('Incomplete').badge).toContain('INCOMPLETE');
  });
});

describe('Flow guards for direct URLs into the reporting flow', () => {
  const blank = draft({ photo: null, beachId: null, beachName: null, quantities: {} });

  it('keeps an empty draft on the first step', () => {
    expect(reachableStep(blank)).toBe('photo');
    expect(guardStep('review', blank)).toBe('/report/photo');
    expect(guardStep('details', blank)).toBe('/report/photo');
    expect(guardStep('photo', blank)).toBeNull();
  });

  it('stops at beach confirmation when a photo has no beach', () => {
    const value = draft({ beachId: null, beachName: null, quantities: {} });
    expect(guardStep('details', value)).toBe('/report/confirm');
    expect(guardStep('confirm', value)).toBeNull();
    expect(guardStep('location', value)).toBeNull();
  });

  it('stops at AI suggestions when a photo and beach have no category', () => {
    const value = draft({ quantities: {} });
    expect(guardStep('review', value)).toBe('/report/suggestions');
    expect(guardStep('suggestions', value)).toBeNull();
  });

  it('treats a category without a quantity band as incomplete', () => {
    const value = draft({ quantities: { Plastic: undefined } });
    expect(guardStep('review', value)).toBe('/report/suggestions');
  });

  it('allows a complete draft to access every step after refresh', () => {
    const value = draft();
    for (const step of ['photo', 'location', 'confirm', 'details', 'suggestions', 'review'] as const) {
      expect(guardStep(step, value)).toBeNull();
    }
  });

  it('requires an AI or manual decision before Review', () => {
    const value = draft({ aiDecision: null });
    expect(reachableStep(value)).toBe('suggestions');
    expect(guardStep('review', value)).toBe('/report/suggestions');
    expect(guardStep('suggestions', value)).toBeNull();
  });

  it('sends a correction with no photo at all back to the photo step', () => {
    const value = draft({ photo: null, existingPhotoUrl: null, existingPhotoKey: null, editingReportId: 'r4' });
    expect(reachableStep(value)).toBe('photo');
    expect(guardStep('review', value)).toBe('/report/photo');
  });

  it('lets a correction keep a photo it was stored with, by key alone', () => {
    const value = draft({ photo: null, existingPhotoKey: 'mock/1.jpg', editingReportId: 'r3' });
    expect(reachableStep(value)).toBe('review');
    expect(guardStep('photo', value)).toBeNull();
  });

  it('accepts the existing photo while editing a record', () => {
    expect(reachableStep(draft({ photo: null, existingPhotoUrl: 'data:image/png;base64,x' }))).toBe('review');
  });
});

describe('Report draft entry', () => {
  it('recognises a draft that should be offered for resume', () => {
    const blank = draft({
      photo: null,
      existingPhotoUrl: null,
      beachId: null,
      beachName: null,
      locationSource: null,
      quantities: {},
      editingReportId: null,
    });
    expect(hasDraftProgress(blank)).toBe(false);
    expect(hasDraftProgress(draft({ quantities: { Plastic: 'Small' } }))).toBe(true);
  });
});

describe('Map marker accessibility', () => {
  it('includes a readable beach label and keyboard target', () => {
    const beach: BeachSummary = {
      id: 'morib',
      name: 'Pantai Morib',
      area: 'Banting',
      lat: 2.746,
      lng: 101.44,
      severity: 'High',
      band: 3,
      insufficientData: false,
      validReports: 3,
      attentionScore: 2.8,
      eligibleReportCount: 3,
      lastReportedAt: null,
      freshnessKind: 'ok',
      habitat: 'mudflat',
      habitatTag: 'MUD FLAT',
      sensitivity: 'medium',
      primarySpeciesGlyph: 'bird',
      speciesNames: [],
      coverImageUrl: null,
      scene: '#123456',
    };

    const html = markerHtml(beach, false, 'litter', 'bird');
    expect(html).toContain('aria-label="Pantai Morib · HIGH"');
    expect(html).toContain('tabindex="0"');

    const insufficientHtml = markerHtml({ ...beach, validReports: 1 }, false, 'litter', 'bird');
    expect(insufficientHtml).toContain('aria-label="Pantai Morib · NO DATA"');
    expect(insufficientHtml).not.toContain('>HIGH</b>');

    const compactHtml = markerHtml(beach, false, 'litter', 'bird', [0, 0], true);
    expect(compactHtml).toContain('aria-label="Pantai Morib · HIGH"');
    expect(compactHtml).toContain('tabindex="0"');
    expect(compactHtml).not.toContain('>HIGH</b>');
    expect(compactHtml.length).toBeLessThan(html.length);
  });
});

describe('Returning from review to details', () => {
  it('pops the history when the details screen stamped the navigation', () => {
    expect(backFromReview({ from: CAME_FROM_DETAILS })).toEqual({ pop: true });
  });

  it('does NOT pop when the user arrived from a resumed draft', () => {
    expect(backFromReview(null)).toEqual({ pop: false, to: '/report/details' });
    expect(backFromReview(undefined)).toEqual({ pop: false, to: '/report/details' });
  });

  it('does not pop for a bookmark or a typed URL, which carry no state', () => {
    expect(backFromReview({})).toEqual({ pop: false, to: '/report/details' });
  });

  it('ignores a stamp it does not recognise', () => {
    expect(backFromReview({ from: 'somewhere-else' })).toEqual({ pop: false, to: '/report/details' });
  });

  it('returns either back or replace and never loops to itself', () => {
    for (const state of [null, undefined, {}, { from: '' }, { from: 'home' }, { from: CAME_FROM_DETAILS }]) {
      const result = backFromReview(state);
      expect(result.pop === true || (result.pop === false && result.to === '/report/details')).toBe(true);
    }
  });
});

describe('Completing a report submission', () => {
  it('navigates to the saved screen before clearing the review draft', () => {
    const events: string[] = [];
    finishReportSubmission((to, options) => events.push(`navigate:${to}:${options.replace}:${options.flushSync}`));
    expect(events).toEqual(['navigate:/report/saved:true:true']);
  });
});

describe('orderByNeed', () => {
  const beach = (name: string, overrides: Partial<{ severity: string | null; insufficientData: boolean; validReports: number; attentionScore: number | null }> = {}) => ({
    name,
    severity: overrides.severity ?? 'Moderate',
    insufficientData: overrides.insufficientData ?? false,
    validReports: overrides.validReports ?? 5,
    attentionScore: overrides.attentionScore ?? 2,
  });

  it('puts the highest attention score first', () => {
    const out = orderByNeed([
      beach('Low one', { attentionScore: 1.2 }),
      beach('High one', { attentionScore: 3.1 }),
      beach('Middle', { attentionScore: 2.0 }),
    ]);
    expect(out.map((item) => item.name)).toEqual(['High one', 'Middle', 'Low one']);
  });

  it('puts every unrated beach after every rated one, however high its count', () => {
    const out = orderByNeed([
      beach('No band', { insufficientData: true, severity: null, attentionScore: null, validReports: 2 }),
      beach('Rated low', { attentionScore: 0.4 }),
    ]);
    expect(out.map((item) => item.name)).toEqual(['Rated low', 'No band']);
  });

  it('orders unrated beaches by how close they are to the threshold', () => {
    const out = orderByNeed([
      beach('Never reported', { insufficientData: true, severity: null, attentionScore: null, validReports: 0 }),
      beach('Nearly there', { insufficientData: true, severity: null, attentionScore: null, validReports: 2 }),
    ]);
    expect(out.map((item) => item.name)).toEqual(['Nearly there', 'Never reported']);
  });

  it('breaks ties on name so the order cannot wobble between fetches', () => {
    const same = { attentionScore: 2.0 };
    expect(orderByNeed([beach('Zeta', same), beach('Alpha', same)]).map((item) => item.name))
      .toEqual(['Alpha', 'Zeta']);
  });

  it('does not mutate the array it was given', () => {
    const input = [beach('B', { attentionScore: 1 }), beach('A', { attentionScore: 9 })];
    const before = input.map((item) => item.name);
    orderByNeed(input);
    expect(input.map((item) => item.name)).toEqual(before);
  });
});
