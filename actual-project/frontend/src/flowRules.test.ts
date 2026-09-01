// Tests for the report-flow rules, and for the two small helpers the map and
// the beach page lean on.
//
// WHY THESE AND NOT THE SCREENS. The rules in flowRules.ts are pure functions:
// give one a draft, it returns a decision, with no React and no browser
// involved. attentionStateFor and markerHtml have the same shape - values in,
// a label or a string of HTML out. That makes them cheap to test and cheap to
// trust. The same logic buried inside a component would need a rendered page
// and a fake router before a single case could be checked.
//
// One of these tests exists because of a real bug that shipped - see the
// "Returning from review to details" block near the bottom.
import { describe, expect, it } from 'vitest';
import type { ReportDraft } from './AppContext';
import {
  backFromReview,
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

// A complete, valid draft. Each test passes in only the fields it wants to
// break, so a test reads as "this one thing is wrong" rather than twelve lines
// of setup that hide which field the case is actually about.
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

// A beach with one or two reports gets no severity band at all. Three counted
// reports is the minimum the scoring method asks for, and printing "High" off
// a single report would be a claim the data cannot support. These tests hold
// that line, including the sentence that tells the reader why there is no band
// yet.
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

// safeNextPath cleans the "?next=" value we redirect to after login. That
// value comes from the URL, so anyone can put anything in it - these tests are
// the guard against an open redirect off our own site.
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

  // Correcting a report must not quietly change how its location was found.
  // There are no fresh coordinates in the draft, so neither field is sent, and
  // the report keeps the GPS source it was filed with.
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

// What happens when somebody types a URL straight into the middle of the
// report flow, or opens an old bookmark. This is a web-only problem: a phone
// app has no address bar.
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

// Whether the app should offer "carry on with your report" when the user comes
// back. An empty draft must not set that off, or someone who has never started
// a report is asked to resume one that does not exist.
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

// The map pins are built as plain HTML, not as React, so nothing else checks
// them. A pin has to carry a spoken label and be reachable by keyboard, or the
// map cannot be used with a screen reader or without a mouse. The second half
// also proves a pin with too few reports never announces a band it does not
// have.
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
  });
});

// This branch once called itself. With the index at 0 it recursed for ever,
// the stack overflowed, and every "Change" link, the back arrow and "Back to
// details" all stopped working. It was invisible in normal use, because
// walking the flow normally never produces index 0 - only a refresh or a
// bookmark does. These four tests exist so it cannot happen again.
describe('Returning from review to details when the history index is zero', () => {


  it('returns a fallback path without popping at index zero', () => {
    expect(backFromReview(0)).toEqual({ pop: false, to: '/report/details' });
  });

  it('returns a fallback when the history index is missing', () => {
    expect(backFromReview(undefined)).toEqual({ pop: false, to: '/report/details' });
    expect(backFromReview(null)).toEqual({ pop: false, to: '/report/details' });
  });

  it('pops the stack only when the history index is positive', () => {
    expect(backFromReview(1)).toEqual({ pop: true });
    expect(backFromReview(7)).toEqual({ pop: true });
  });

  it('returns either back or replace and never loops to itself', () => {
    for (const idx of [-1, 0, 1, 2, undefined, null]) {
      const r = backFromReview(idx);
      expect(r.pop === true || (r.pop === false && r.to === '/report/details')).toBe(true);
    }
  });
});

// Proves the navigation is committed with flushSync, before the draft is
// cleared. Without it the review page's guard sees an empty draft mid-update
// and bounces the user back to step 1 instead of showing their confirmation.
describe('Completing a report submission', () => {
  it('navigates to the saved screen before clearing the review draft', () => {
    const events: string[] = [];
    finishReportSubmission(
      (to, options) => events.push(`navigate:${to}:${options.replace}:${options.flushSync}`),
    );

    expect(events).toEqual(['navigate:/report/saved:true:true']);
  });
});
