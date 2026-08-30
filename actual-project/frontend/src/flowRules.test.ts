import { describe, expect, it } from 'vitest';
import type { ReportDraft } from './AppContext';
import { buildReportSubmission, reportOutcome, safeNextPath } from './flowRules';

function draft(changes: Partial<ReportDraft> = {}): ReportDraft {
  return {
    photo: { photoKey: 'mock/test.jpg', previewUrl: 'blob:test', metadataStripped: true },
    existingPhotoUrl: null,
    beachId: 'morib',
    beachName: 'Pantai Morib',
    locationSource: 'manual',
    coords: null,
    quantities: { Plastic: 'Small' },
    gpsDenied: false,
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
