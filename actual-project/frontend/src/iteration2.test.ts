import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyseReportPhoto,
  completeCleanup,
  createAdminEvent,
  formatEventDate,
  getCleanupEvent,
  getCleanupTarget,
  joinCleanupEvent,
  listCleanupEvents,
  normalizeSuggestedCounts,
  effectiveAiModelState,
} from './iteration2';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

beforeEach(() => storage.clear());

describe('Iteration 2 date presentation', () => {
  it('prints the exact date first and the verified weekday in brackets', () => {
    expect(formatEventDate('2026-09-12')).toBe('2026-09-12 (Sat)');
    expect(formatEventDate('2026-09-16')).toBe('2026-09-16 (Wed)');
  });
});

describe('Iteration 2 activity and cleanup ledger', () => {
  it('keeps detector counts internal and only normalizes positive whole detections', () => {
    expect(normalizeSuggestedCounts({ Plastic: 8, Glass: 0, Metal: 2.8 })).toEqual({ Plastic: 8 });
  });

  it('treats a ready response with no detections as empty', () => {
    expect(effectiveAiModelState('ready', {})).toBe('empty');
  });

  it('generates four Saturday events per configured beach before the attention gate is applied', async () => {
    expect(await listCleanupEvents()).toHaveLength(16);
  });

  it('makes Join idempotent for the same participant and event', async () => {
    const event = (await listCleanupEvents()).find((item) => item.beachId === 'morib')!;
    const first = await joinCleanupEvent(event.id, '1637');
    const second = await joinCleanupEvent(event.id, '1637');
    expect(second.participantCount).toBe(first.participantCount);
    expect(second.joinedBy).toEqual(['1637']);
  });

  it('creates at most one admin event for a beach and date', async () => {
    const first = await createAdminEvent({ beachId: 'morib', date: '2030-01-02' });
    const second = await createAdminEvent({ beachId: 'morib', date: '2030-01-02' });
    expect(second.id).toBe(first.id);
    expect((await getCleanupEvent(first.id))?.source).toBe('admin');
  });

  it('records linked cleanup as the remaining band state and resolves all-Small targets', async () => {
    const target = (await getCleanupTarget('morib'))!;
    expect(target.remainingQuantities.Plastic).toBe('Very Large');

    const cleanup = await completeCleanup({
      participantId: '1637',
      targetReportId: target.reportId,
      remainingQuantities: {
        Plastic: 'Small',
        'Fishing gear': 'Small',
        Glass: 'Small',
        Metal: 'Small',
        Paper: 'Small',
        Other: 'Small',
      },
      handling: 'Collected for disposal',
    });

    expect(cleanup.resolved).toBe(true);
    expect(cleanup.remainingQuantities).toEqual({
      Plastic: 'Small',
      'Fishing gear': 'Small',
      Glass: 'Small',
      Metal: 'Small',
      Paper: 'Small',
      Other: 'Small',
    });
    expect(cleanup.score).toBe(8);
    expect(await getCleanupTarget('morib', target.reportId)).toBeNull();
  });

  it('scores a standalone cleanup from removed quantity bands', async () => {
    const cleanup = await completeCleanup({
      participantId: '1637',
      beachId: 'kelanang',
      removedQuantities: { Plastic: 'Large', Glass: 'Small' },
      handling: 'Collected for disposal',
    });
    expect(cleanup.targetReportId).toBeNull();
    expect(cleanup.removedQuantities).toEqual({ Plastic: 'Large', Glass: 'Small' });
    expect(cleanup.score).toBe(4);
  });

  it('keeps manual reporting available when AI is unavailable', async () => {
    const result = await analyseReportPhoto('mock/photo.jpg', true);
    expect(result.modelState).toBe('unavailable');
    expect(result.suggestions).toEqual({});
  });

  it('returns no detector evidence when recognition has zero counts', () => {
    expect(normalizeSuggestedCounts({ Plastic: 0, Glass: 0 })).toEqual({});
  });
});
