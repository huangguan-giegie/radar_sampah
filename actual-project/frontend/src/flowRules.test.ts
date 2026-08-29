import { describe, expect, it } from 'vitest';
import type { ReportDraft } from './AppContext';
import {
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
    // 回归：改正是整体替换 PATCH，草稿必须带着原记录的全部类别，
    // 否则只换一张照片就会把其他类别的列清空。
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

describe('流程守卫（直接输网址跳进上报流程中间）', () => {
  const blank = draft({ photo: null, beachId: null, beachName: null, quantities: {} });

  it('空草稿只能停在第一步', () => {
    expect(reachableStep(blank)).toBe('photo');
    expect(guardStep('review', blank)).toBe('/report/photo');
    expect(guardStep('details', blank)).toBe('/report/photo');
    expect(guardStep('photo', blank)).toBeNull();
  });

  it('有照片没海滩 —— 停在确认海滩那一步', () => {
    const d = draft({ beachId: null, beachName: null, quantities: {} });
    expect(guardStep('details', d)).toBe('/report/confirm');
    expect(guardStep('confirm', d)).toBeNull();
    // 确认页上那个「换一片海滩」会把 beachId 清掉。
    // 如果这一步要求有海滩，那个按钮会把用户从选海滩的页面上赶走。
    expect(guardStep('location', d)).toBeNull();
  });

  it('有照片有海滩但没选类别 —— 停在填详情那一步', () => {
    const d = draft({ quantities: {} });
    expect(guardStep('review', d)).toBe('/report/details');
    expect(guardStep('details', d)).toBeNull();
  });

  it('选了类别却没选数量档，一样不算填完', () => {
    const d = draft({ quantities: { Plastic: undefined } });
    expect(guardStep('review', d)).toBe('/report/details');
  });

  it('填完的草稿哪一步都能去 —— 刷新恢复回来的草稿也一样', () => {
    const d = draft();
    for (const step of ['photo', 'location', 'confirm', 'details', 'review'] as const) {
      expect(guardStep(step, d)).toBeNull();
    }
  });

  it('修正已有记录：没有新照片也能从第一步进来换照片', () => {
    // My Reports 点一条 Incomplete 记录，草稿是填满的，但故意回到第 1 步。
    // 守卫只往回赶不往前推，就是为了这条路径 —— 往前推的话他没法换照片。
    const d = draft({ photo: null, editingReportId: 'r3' });
    expect(reachableStep(d)).toBe('review');
    expect(guardStep('photo', d)).toBeNull();
  });

  it('修正记录时沿用原来的照片，也算这一步过了', () => {
    const d = draft({ photo: null, existingPhotoUrl: 'data:image/png;base64,x' });
    expect(reachableStep(d)).toBe('review');
  });
});
