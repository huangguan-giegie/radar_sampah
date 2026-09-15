import { describe, expect, it } from 'vitest';
import type { ReportDraft } from './AppContext';
import { buildReportSubmission, formatReportComposition, reachableStep } from './flowRules';

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
    quantities: { Plastic: 'Medium', Glass: 'Small' },
    itemCounts: null,
    eventId: null,
    aiDecision: 'confirmed',
    aiModelState: 'ready',
    aiModelVersion: 'test-model',
    gpsIssue: null,
    editingReportId: null,
    editingStatus: null,
    editingStatusNote: null,
    ...changes,
  };
}

describe('Iteration 2 final quantity-band contract', () => {
  it('uses confirmed bands as the authoritative create payload even when legacy counts exist', () => {
    const result = buildReportSubmission(draft({
      quantities: { Plastic: 'Large', Glass: 'Medium' },
      itemCounts: { Plastic: 27, Glass: 8 },
    }));

    expect(result.kind).toBe('create');
    if (result.kind === 'create') {
      expect(result.payload.quantities).toEqual({ Plastic: 'Large', Glass: 'Medium' });
      expect(result.payload).not.toHaveProperty('itemCounts');
    }
  });

  it('allows an AI-ready draft to reach review using category and band suggestions only', () => {
    expect(reachableStep(draft({
      quantities: { Plastic: 'Medium' },
      itemCounts: null,
      aiDecision: 'confirmed',
      aiModelState: 'ready',
    }))).toBe('review');
  });

  it('always presents quantity bands instead of legacy exact counts', () => {
    expect(formatReportComposition(
      { Plastic: 'Medium', Glass: 'Small' },
      { Plastic: 8, Glass: 2 },
    )).toBe('Plastic — Medium · Glass — Small');
  });
});
