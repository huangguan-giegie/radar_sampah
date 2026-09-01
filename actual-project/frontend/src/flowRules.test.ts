import { describe, expect, it } from 'vitest';
import type { ReportDraft } from './AppContext';
import {
  backFromReview,
  CAME_FROM_DETAILS,
  buildReportSubmission,
  finishReportSubmission,
  guardStep,
  reachableStep,
  reportOutcome,
  safeNextPath,
  hasDraftProgress,
} from './flowRules';
import { markerHtml } from './components/BeachMarker';
import type { BeachSummary } from './types';
import { attentionStateFor } from './theme';

function draft(changes: Partial<ReportDraft> = {}): ReportDraft {
  return {
    photo: { photoKey: 'mock/test.jpg', previewUrl: 'blob:test', metadataStripped: true },
    existingPhotoUrl: null,
    existingPhotoKey: null,
    beachId: 'morib',
    beachName: 'Pantai Morib',
    locationSource: 'manual',
    coords: null,
    quantities: { Plastic: 'Small' },
    gpsIssue: null,
    editingReportId: null,
    editingStatus: null,
    editingStatusNote: null,
    ...changes,
  };
}

describe('attentionStateFor', () => {
  it.each([0, 1, 2])('keeps %s counted reports in a neutral insufficient-data state', (validReports) => {
    const reportWord = validReports === 1 ? 'report' : 'reports';
    expect(attentionStateFor(null, true, validReports)).toEqual({
      markerLabel: 'NO DATA',
      pageLabel: 'Insufficient data',
      detail: `${validReports} counted ${reportWord} · At least 3 counted reports are required for a band`,
      hasBand: false,
    });
  });

  it('shows the severity label once the beach has enough counted reports', () => {
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
    (value) => {
      expect(safeNextPath(value)).toBe('/home');
    },
  );
});

describe('buildReportSubmission', () => {
  it('includes coordinates only for a GPS report', () => {
    const result = buildReportSubmission(
      draft({ locationSource: 'gps', coords: { lat: 2.95, lng: 101.42 } }),
    );
    expect(result.kind).toBe('create');
    if (result.kind === 'create') {
      expect(result.payload.locationSource).toBe('gps');
      expect(result.payload.coords).toEqual({ lat: 2.95, lng: 101.42 });
    }
  });

  it('removes stale coordinates from a manual report', () => {
    const result = buildReportSubmission(
      draft({ locationSource: 'manual', coords: { lat: 2.95, lng: 101.42 } }),
    );
    expect(result.kind).toBe('create');
    if (result.kind === 'create') {
      expect(result.payload.locationSource).toBe('manual');
      expect(result.payload).not.toHaveProperty('coords');
    }
  });

  it('carries every picked category through to the payload', () => {
    const result = buildReportSubmission(
      draft({ quantities: { Plastic: 'Large', 'Fishing gear': 'Medium', Glass: 'Small' } }),
    );
    expect(result.kind).toBe('create');
    if (result.kind === 'create') {
      expect(result.payload.quantities).toEqual({
        Plastic: 'Large',
        'Fishing gear': 'Medium',
        Glass: 'Small',
      });
    }
  });

  it('refuses a report with no category at all', () => {
    expect(() => buildReportSubmission(draft({ quantities: {} }))).toThrow(/missing a required field/);
  });

  it('refuses a category that was picked but given no quantity band', () => {
    expect(() =>
      buildReportSubmission(draft({ quantities: { Plastic: 'Large', Glass: undefined } })),
    ).toThrow(/Glass/);
  });

  it('keeps every category when only the photo is corrected', () => {


    const result = buildReportSubmission(
      draft({
        editingReportId: 'report-1',
        quantities: { Plastic: 'Large', 'Fishing gear': 'Medium', Glass: 'Small' },
      }),
    );
    expect(result.kind).toBe('update');
    if (result.kind === 'update') {
      expect(result.changes.quantities).toEqual({
        Plastic: 'Large',
        'Fishing gear': 'Medium',
        Glass: 'Small',
      });
    }
  });

  it('allows an existing report to be corrected without a replacement photo', () => {
    const result = buildReportSubmission(
      draft({ editingReportId: 'report-1', photo: null, existingPhotoUrl: '/existing.jpg' }),
    );
    expect(result).toEqual({
      kind: 'update',
      reportId: 'report-1',
      changes: {
        beachId: 'morib',
        quantities: { Plastic: 'Small' },
        locationSource: 'manual',
      },
    });
  });

  it('preserves the original GPS source when correcting without new coordinates', () => {
    const result = buildReportSubmission(
      draft({
        editingReportId: 'report-gps',
        photo: null,
        existingPhotoUrl: '/existing.jpg',
        locationSource: 'gps',
        coords: null,
      }),
    );
    expect(result.kind).toBe('update');
    if (result.kind === 'update') {
      expect(result.changes).not.toHaveProperty('locationSource');
      expect(result.changes).not.toHaveProperty('coords');
    }
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
    const d = draft({ beachId: null, beachName: null, quantities: {} });
    expect(guardStep('details', d)).toBe('/report/confirm');
    expect(guardStep('confirm', d)).toBeNull();


    expect(guardStep('location', d)).toBeNull();
  });

  it('stops at details when a photo and beach have no category', () => {
    const d = draft({ quantities: {} });
    expect(guardStep('review', d)).toBe('/report/details');
    expect(guardStep('details', d)).toBeNull();
  });

  it('treats a category without a quantity band as incomplete', () => {
    const d = draft({ quantities: { Plastic: undefined } });
    expect(guardStep('review', d)).toBe('/report/details');
  });

  it('allows a complete draft to access every step after refresh', () => {
    const d = draft();
    for (const step of ['photo', 'location', 'confirm', 'details', 'review'] as const) {
      expect(guardStep(step, d)).toBeNull();
    }
  });

  it('allows editing to re-enter the photo step without a new photo', () => {


    const d = draft({ photo: null, editingReportId: 'r3' });
    expect(reachableStep(d)).toBe('review');
    expect(guardStep('photo', d)).toBeNull();
  });

  it('accepts the existing photo while editing a record', () => {
    const d = draft({ photo: null, existingPhotoUrl: 'data:image/png;base64,x' });
    expect(reachableStep(d)).toBe('review');
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

    // Zoomed out the beaches converge and the pills overlap into an unreadable
    // stack, so the pin drops to a dot. It has to stay reachable: the label and
    // the keyboard affordances sit on the wrapper, not on the pill.
    const compactHtml = markerHtml(beach, false, 'litter', 'bird', [0, 0], true);
    expect(compactHtml).toContain('aria-label="Pantai Morib · HIGH"');
    expect(compactHtml).toContain('tabindex="0"');
    expect(compactHtml).not.toContain('>HIGH</b>');
    expect(compactHtml.length).toBeLessThan(html.length);
  });

});

// Going back from the review screen. The rule is no longer "is there anything
// behind me in the history" - it is "is the DETAILS screen behind me", and only
// RecordScreen can answer that, by stamping the navigation.
describe('Returning from review to details', () => {
  it('pops the history when the details screen stamped the navigation', () => {
    expect(backFromReview({ from: CAME_FROM_DETAILS })).toEqual({ pop: true });
  });

  // The regression this rewrite exists for. resumePath() can send a restored
  // draft straight to /report/review from the home or beach screen. That pushes
  // a history entry, so the old index-based check saw "index > 0" and popped -
  // straight back out to /home, out of the report flow entirely.
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
      const r = backFromReview(state);
      expect(r.pop === true || (r.pop === false && r.to === '/report/details')).toBe(true);
    }
  });
});

describe('Completing a report submission', () => {
  it('navigates to the saved screen before clearing the review draft', () => {
    const events: string[] = [];
    finishReportSubmission(
      (to, options) => events.push(`navigate:${to}:${options.replace}:${options.flushSync}`),
    );

    expect(events).toEqual(['navigate:/report/saved:true:true']);
  });
});
