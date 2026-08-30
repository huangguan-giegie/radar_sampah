import { describe, expect, it } from 'vitest';
import type { ReportDraft } from './AppContext';
import {
  backFromReview,
  buildReportSubmission,
  guardStep,
  reachableStep,
  reportOutcome,
  safeNextPath,
} from './flowRules';

function draft(changes: Partial<ReportDraft> = {}): ReportDraft {
  return {
    photo: { photoKey: 'mock/test.jpg', previewUrl: 'blob:test', metadataStripped: true },
    existingPhotoUrl: null,
    beachId: 'morib',
    beachName: 'Pantai Morib',
    locationSource: 'manual',
    coords: null,
    quantities: { Plastic: 'Small' },
    gpsIssue: null,
    editingReportId: null,
    ...changes,
  };
}

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
