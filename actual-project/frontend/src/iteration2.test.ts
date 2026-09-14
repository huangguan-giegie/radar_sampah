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
  it('keeps only positive whole AI counts', () => {
    expect(normalizeSuggestedCounts({ Plastic: 8, Glass: 0, Metal: 2.8 })).toEqual({ Plastic: 8 });
  });

  it('treats a ready response with no detections as empty', () => {
    expect(effectiveAiModelState('ready', {})).toBe('empty');
  });

  it('generates four Saturday events per configured beach', async () => {
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

  it('subtracts partial cleanup actions repeatedly without going below zero', async () => {
    const target = (await getCleanupTarget('morib'))!;
    const cleanup = await completeCleanup({
      participantId: '1637',
      targetReportId: target.reportId,
      removed: { Plastic: 62, Glass: 2 },
      handling: 'Collected for disposal',
    });
    expect(cleanup.score).toBe(64);
    expect(cleanup.rows.find((row) => row.category === 'Plastic')).toMatchObject({ before: 62, removed: 62, after: 0 });
    expect((await getCleanupTarget('morib'))?.remaining.Glass).toBe(13);
    const next = await completeCleanup({ participantId: '1637', targetReportId: target.reportId, removed: { Glass: 1 }, handling: 'Not recorded' });
    expect(next.id).not.toBe(cleanup.id);
    expect((await getCleanupTarget('morib'))?.remaining.Glass).toBe(12);
  });

  it('keeps manual reporting available when AI is unavailable', async () => {
    const result = await analyseReportPhoto('mock/photo.jpg', true);
    expect(result.modelState).toBe('unavailable');
    expect(result.suggestions).toEqual({});
  });

  it('returns no cleanup suggestion when recognition has zero counts', () => {
    expect(normalizeSuggestedCounts({ Plastic: 0, Glass: 0 })).toEqual({});
  });
});
